const Team = require('../models/Team');
const ServiceOrder = require('../models/ServiceOrder');
const ServiceHistory = require('../models/ServiceHistory');
const Alert = require('../models/Alert');
const logger = require('../config/logger');

const IXC_URL = process.env.IXC_URL;
const IXC_TOKEN = process.env.IXC_TOKEN;

const STATUS_MAP = {
  'A': { label: 'Aberto' },
  'AN': { label: 'Análise' },
  'EN': { label: 'Encaminhada' },
  'AS': { label: 'Assumida' },
  'AG': { label: 'Agendado' },
  'DS': { label: 'Deslocamento' },
  'EX': { label: 'Execução' },
  'F': { label: 'Finalizado' }
};

let subjectCache = {};
let clientCache = {};
let techCache = {};

async function getTechnicianName(id) {
  if (!id) return 'Técnico';
  const sId = String(id);
  if (techCache[sId]) return techCache[sId];
  
  // Tenta banco local primeiro
  const team = await Team.findOne({ id: sId });
  if (team) {
    techCache[sId] = team.name;
    return team.name;
  }

  // Tenta IXC em tempo real
  try {
    const response = await fetch(`${IXC_URL}/funcionarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({ qtype: 'funcionarios.id', query: sId, oper: '=', rp: '1' })
    });
    const data = await response.json();
    const name = data.registros?.[0]?.funcionario || 'Técnico';
    techCache[sId] = name;
    return name;
  } catch (e) {
    logger.error(`[IXC] Erro ao buscar técnico ${sId}: ${e.message}`);
    return 'Técnico';
  }
}

async function getClientName(id) {
  if (!id) return 'Não identificado';
  if (clientCache[id] && clientCache[id] !== 'Não identificado') return clientCache[id];
  try {
    const response = await fetch(`${IXC_URL}/cliente`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({ qtype: 'cliente.id', query: id, oper: '=', rp: '1' })
    });
    const data = await response.json();
    const name = data.registros?.[0]?.razao || data.registros?.[0]?.nome_fantasia || 'Não identificado';
    clientCache[id] = name;
    return name;
  } catch (e) {
    logger.error(`[IXC] Erro ao buscar cliente ${id}: ${e.message}`);
    return 'Não identificado';
  }
}

async function getSubjectName(id) {
  if (!id) return 'Não informado';
  if (subjectCache[id] && subjectCache[id] !== 'Não informado') return subjectCache[id];
  try {
    const response = await fetch(`${IXC_URL}/su_oss_assunto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({ qtype: 'su_oss_assunto.id', query: id, oper: '=', rp: '1' })
    });
    const data = await response.json();
    if (data && data.registros && data.registros.length > 0) {
      const name = data.registros[0].assunto;
      subjectCache[id] = name;
      return name;
    }
  } catch (error) {
    logger.error('[IXC] Erro ao buscar nome do assunto: %s', error.message);
  }
  return 'Não informado';
}

function parseIXCDate(dateStr) {
  if (!dateStr || dateStr.includes('0000-00-00') || dateStr === '') return null;
  const brParts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brParts) {
    const timeParts = dateStr.match(/(\d{2}):(\d{2}):(\d{2})/) || [0, 0, 0, 0];
    return new Date(brParts[3], brParts[2] - 1, brParts[1], timeParts[1], timeParts[2], timeParts[3]);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function syncIXCTeamCollaborators() {
  logger.info('[IXC] Sincronizando Equipes e Colaboradores...');
  try {
    const employeesResponse = await fetch(`${IXC_URL}/funcionarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({ qtype: 'funcionarios.ativo', query: 'S', oper: '=', rp: '1000' })
    });
    const employeesData = await employeesResponse.json();
    const nameMap = {};
    const activeEmployeeIds = new Set();
    
    if (employeesData.registros) {
      employeesData.registros.forEach(f => { 
        nameMap[f.id] = f.funcionario; 
        activeEmployeeIds.add(String(f.id));
      });
    }

    const response = await fetch(`${IXC_URL}/funcionarios_equipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({ qtype: 'funcionarios_equipes.id', query: '0', oper: '>', rp: '1000' })
    });

    const data = await response.json();
    if (data && data.registros) {
      for (const f of data.registros) {
        if (activeEmployeeIds.has(String(f.id_funcionario))) {
          const nomeReal = nameMap[f.id_funcionario];
          await Team.findOneAndUpdate(
            { id: String(f.id_funcionario) },
            { name: nomeReal, teamId: String(f.id) },
            { upsert: true }
          );
        }
      }
    }
  } catch (error) {
    logger.error('[IXC] Erro no cruzamento de dados: %s', error.message);
  }
}

async function syncIXCServiceOrders(io) {
  await syncIXCTeamCollaborators();
  try {
    // 1. Busca as O.S. ativas do IXC (Abertas, Agendadas, Deslocamento, Execução, etc.)
    // Filtramos por status que NÃO são 'F' (Finalizado) ou 'C' (Cancelado)
    const activeStatuses = ['A', 'AN', 'EN', 'AS', 'AG', 'DS', 'EX'];
    
    // Para simplificar e garantir que pegamos tudo que importa, pegamos as últimas 1000
    // mas vamos cruzar com o que temos no banco.
    const response = await fetch(`${IXC_URL}/su_oss_chamado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({ 
        qtype: 'su_oss_chamado.id', 
        query: '0', 
        oper: '>', 
        rp: '1000', 
        sortname: 'su_oss_chamado.id', 
        sortorder: 'desc' 
      })
    });
    
    const data = await response.json();
    if (!data || !data.registros) return;

    const ixcIdsPresent = new Set();

    // Processamento em lotes paralelos
    const batchSize = 20;
    for (let i = 0; i < data.registros.length; i += batchSize) {
      const batch = data.registros.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (os) => {
        ixcIdsPresent.add(String(os.id));
        const tecnicoId = os.id_responsavel || os.id_colaborador || os.id_tecnico;
        
        let clientName = os.razao || os.cliente || os.nome_cliente || os.razao_social || os.cliente_razao || os.nome || os.fantasia || os.cliente_nome;
        if (!clientName || clientName === 'Não identificado') {
          clientName = await getClientName(os.id_cliente);
        }

        let subjectName = os.assunto || os.su_assunto || os.descricao_assunto || os.assunto_nome;
        if (!subjectName || subjectName === 'Não informado') {
          subjectName = await getSubjectName(os.id_assunto);
        }

        const oldOS = await ServiceOrder.findOne({ ixcId: os.id });
        
        // Detecta mudança de status para Alertas e Histórico
        if (oldOS && oldOS.status !== os.status && ['DS', 'EX', 'F'].includes(os.status)) {
            const techName = await getTechnicianName(tecnicoId);
            let msg = '';
            const now = new Date();

            if (os.status === 'DS') {
                msg = `${techName} iniciou deslocamento para O.S. do cliente ${clientName}.`;
                // Cria ou atualiza histórico inicial
                await ServiceHistory.findOneAndUpdate(
                    { osId: String(os.id) },
                    { 
                        osNumber: os.protocolo, 
                        teamId: String(tecnicoId), 
                        teamName: techName, 
                        client: clientName, 
                        subject: subjectName, 
                        startTime: now,
                        location: { lat: parseFloat(os.latitude), lng: parseFloat(os.longitude) }
                    },
                    { upsert: true }
                );
            } 
            else if (os.status === 'EX') {
                msg = `${techName} iniciou o serviço na O.S. do cliente ${clientName}.`;
                // Registra chegada e calcula tempo de deslocamento
                const hist = await ServiceHistory.findOne({ osId: String(os.id) });
                if (hist && hist.startTime) {
                    const diffMin = Math.round((now - hist.startTime) / 60000);
                    await ServiceHistory.updateOne({ _id: hist._id }, { arrivalTime: now, durationDrive: diffMin });
                } else {
                    await ServiceHistory.findOneAndUpdate(
                        { osId: String(os.id) },
                        { osNumber: os.protocolo, teamId: String(tecnicoId), teamName: techName, client: clientName, subject: subjectName, arrivalTime: now },
                        { upsert: true }
                    );
                }
            } 
            else if (os.status === 'F') {
                msg = `${techName} finalizou o serviço na O.S. do cliente ${clientName}.`;
                // Atualiza a O.S. com a data de finalização real
                await ServiceOrder.updateOne({ ixcId: os.id }, { finishedAt: now });
                
                // Finaliza histórico e calcula tempo de atendimento
                const hist = await ServiceHistory.findOne({ osId: String(os.id) });
                if (hist && hist.arrivalTime) {
                    const diffMin = Math.round((now - hist.arrivalTime) / 60000);
                    await ServiceHistory.updateOne({ _id: hist._id }, { endTime: now, durationService: diffMin });
                } else if (hist) {
                    await ServiceHistory.updateOne({ _id: hist._id }, { endTime: now });
                }
            }

            if (msg) {
                await Alert.create({ type: 'Warning', message: msg, device: techName, timestamp: new Date() });
                if (io) io.emit('status_notification', { message: msg, type: os.status, tech: techName });
            }
        }

        await ServiceOrder.findOneAndUpdate(
          { ixcId: os.id },
          {
            number: os.protocolo,
            client: clientName,
            address: os.endereco || '',
            lat: parseFloat(os.latitude) || 0,
            lng: parseFloat(os.longitude) || 0,
            status: os.status,
            priority: os.prioridade,
            description: os.mensagem,
            subject: subjectName,
            teamId: tecnicoId ? String(tecnicoId) : null,
            scheduledDate: parseIXCDate(os.data_agenda),
            lastSeen: new Date()
          },
          { upsert: true }
        );
      }));
    }

    // ── LIMPEZA DE O.S. ANTIGAS ──
    // Se a O.S. está no nosso banco como ativa (AG, DS, EX) mas não veio no 'listar' do IXC,
    // significa que ela foi finalizada ou saiu da fila de prioridade.
    // Marcamos como 'F' para sumir do mapa.
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    await ServiceOrder.updateMany(
        { 
          ixcId: { $nin: Array.from(ixcIdsPresent) },
          status: { $in: ['AG', 'DS', 'EX', 'A', 'EN', 'AS'] },
          scheduledDate: { $gte: today } // Apenas O.S. de hoje ou futuro
        },
        { status: 'F', lastSeen: new Date() }
    );
    
    logger.info('[IXC] Sincronização de O.S. concluída.');
    if (io) io.emit('os_synced');
  } catch (error) {
    logger.error('[IXC] Erro na sincronização: %s', error.message);
  }
}

module.exports = { syncIXCServiceOrders, syncIXCTeamCollaborators };
