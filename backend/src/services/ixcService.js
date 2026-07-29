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

let lastOSSyncTime = 0;
let lastTeamSyncTime = 0;
let isInitialSync = true;

/**
 * Determina se a transição de status representa um progresso real (unidirecional)
 */
function isForwardProgression(oldStatus, newStatus) {
  const weights = {
    'A': 0, 'AN': 0, 'EN': 0, 'AS': 0,
    'AG': 1,
    'DS': 2,
    'EX': 3,
    'F': 4
  };
  const oldWeight = weights[oldStatus] !== undefined ? weights[oldStatus] : 0;
  const newWeight = weights[newStatus] !== undefined ? weights[newStatus] : 0;
  return newWeight > oldWeight;
}

// Cache TTLs em milissegundos
const OS_CACHE_TTL = 90000; // 1.5 minutos
const TEAM_CACHE_TTL = 300000; // 5 minutos


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

const loginStatusCache = {};

function isRadUsuarioOnline(reg) {
  if (!reg) return false;
  const onlineVal = String(reg.online || '').toUpperCase();
  if (onlineVal === 'S' || onlineVal === 'SS' || onlineVal === 'ONLINE' || onlineVal === '1') {
    return true;
  }
  // Se possuir um IP atribuido (ex: faixa CGNAT 100.x.x.x ou IP fixo/publico) indica conexao ativa no IXC
  const ip = String(reg.online_ip || reg.ip || '').trim();
  if (ip && ip !== '0.0.0.0' && ip !== 'N/A' && ip !== '0' && ip !== 'null' && ip !== 'undefined') {
    return true;
  }
  return false;
}

async function getClientLoginStatus(clientId, loginId) {
  if (!clientId && !loginId) return 'offline';
  const cacheKey = `client_${clientId || loginId}`;
  const now = Date.now();
  const cached = loginStatusCache[cacheKey];
  if (cached && (now - cached.timestamp < 30000)) { // 30s cache TTL
    return cached.status;
  }
  try {
    // 1. Busca por id_cliente para obter todos os logins do cliente
    if (clientId && String(clientId) !== '0') {
      const response = await fetch(`${IXC_URL}/radusuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ixcsoft': 'listar',
          'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
        },
        body: JSON.stringify({ qtype: 'radusuarios.id_cliente', query: String(clientId), oper: '=', rp: '20' })
      });
      const data = await response.json();
      if (data && data.registros && data.registros.length > 0) {
        const hasOnline = data.registros.some(reg => isRadUsuarioOnline(reg));
        const status = hasOnline ? 'online' : 'offline';
        loginStatusCache[cacheKey] = { status, timestamp: now };
        return status;
      }
    }

    // 2. Fallback: Busca por id_login específico se não retornou por id_cliente
    if (loginId && String(loginId) !== '0') {
      const respLogin = await fetch(`${IXC_URL}/radusuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ixcsoft': 'listar',
          'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
        },
        body: JSON.stringify({ qtype: 'radusuarios.id', query: String(loginId), oper: '=', rp: '1' })
      });
      const dataLogin = await respLogin.json();
      if (dataLogin && dataLogin.registros && dataLogin.registros.length > 0) {
        const status = isRadUsuarioOnline(dataLogin.registros[0]) ? 'online' : 'offline';
        loginStatusCache[cacheKey] = { status, timestamp: now };
        return status;
      }
    }

    loginStatusCache[cacheKey] = { status: 'offline', timestamp: now };
    return 'offline';
  } catch (e) {
    logger.error(`[IXC] Erro ao buscar status radusuarios: ${e.message}`);
    return 'offline';
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
  
  const cleanStr = dateStr.trim();
  
  // 1. Tenta formato brasileiro: DD/MM/YYYY HH:mm:ss
  const brParts = cleanStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (brParts) {
    const day = brParts[1];
    const month = brParts[2];
    const year = brParts[3];
    const hour = brParts[4] || '00';
    const minute = brParts[5] || '00';
    const second = brParts[6] || '00';
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
  }
  
  // 2. Tenta formato ISO/DB: YYYY-MM-DD HH:mm:ss ou YYYY-MM-DDTHH:mm:ss
  const isoParts = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[\sT](\d{2}):(\d{2}):(\d{2}))?/);
  if (isoParts) {
    const year = isoParts[1];
    const month = isoParts[2];
    const day = isoParts[3];
    const hour = isoParts[4] || '00';
    const minute = isoParts[5] || '00';
    const second = isoParts[6] || '00';
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
  }

  // 3. Fallback
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) {
    if (!cleanStr.includes('Z') && !cleanStr.match(/[+-]\d{2}:?\d{2}$/)) {
      const adjusted = new Date(cleanStr + ' -03:00');
      if (!isNaN(adjusted.getTime())) return adjusted;
    }
    return d;
  }
  return null;
}


async function syncIXCTeamCollaborators() {
  const now = Date.now();
  if (now - lastTeamSyncTime < TEAM_CACHE_TTL) {
    logger.info('[IXC Cache] Usando cache para colaboradores (última sincronização há menos de 5 min)');
    return;
  }
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

    if (employeesData && employeesData.registros) {
      for (const f of employeesData.registros) {
        await Team.findOneAndUpdate(
          { id: String(f.id) },
          {
            id: String(f.id),
            name: f.funcionario || f.nome,
            phone: f.fone_celular || f.fone || '',
            vehicle: f.cnh_categoria ? `Veículo ${f.cnh_categoria}` : 'Viatura de Campo',
            neighborhood: f.bairro || 'São Luís',
            city: f.cidade || 'São Luís',
            status: f.ativo === 'S' ? 'Disponível' : 'Offline'
          },
          { upsert: true }
        );
      }
      lastTeamSyncTime = Date.now();
      logger.info(`[IXC] ${employeesData.registros.length} colaboradores/técnicos sincronizados.`);
    }
  } catch (error) {
    logger.error('[IXC] Erro na sincronização de colaboradores: %s', error.message);
  }
}

async function syncIXCServiceOrders(io, force = false) {
  const now = Date.now();
  if (!force && (now - lastOSSyncTime < OS_CACHE_TTL)) {
    logger.info('[IXC Cache] Ignorando sincronização de O.S. (último sync há menos de 1.5 min)');
    return;
  }
  lastOSSyncTime = now;
  // Limpa cache de status de logins a cada nova sincronizacao para forcar re-avaliacao em tempo real
  for (const k of Object.keys(loginStatusCache)) {
    delete loginStatusCache[k];
  }
  await syncIXCTeamCollaborators();
  try {
    const now = new Date();
    const brDate = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const todayISO = brDate.toISOString().split('T')[0]; // AAAA-MM-DD
    
    logger.info(`[IXC] Buscando todas as O.S. ativas e agendadas do IXC...`);

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
    logger.info(`[IXC] O.S. encontradas no IXC para hoje: ${data.registros ? data.registros.length : 0}`);
    
    if (!data || !data.registros || data.registros.length === 0) {
        logger.info('[IXC] Nenhuma O.S. encontrada para hoje no IXC.');
        return;
    }

    if (isInitialSync) {
      logger.info('[IXC] Primeira sincronização: limpando O.S. antigas para atualização com horários exatos...');
      await ServiceOrder.deleteMany({});
    }

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
        
        // Detecta mudança de status para Alertas e Histórico (apenas progressões válidas de status)
        if (oldOS && oldOS.status !== os.status && isForwardProgression(oldOS.status, os.status) && ['DS', 'EX', 'F'].includes(os.status)) {
            const techName = await getTechnicianName(tecnicoId);
            let msg = '';

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
                        startTime: parseIXCDate(os.data_deslocamento) || new Date(),
                        location: { lat: parseFloat(os.latitude), lng: parseFloat(os.longitude) }
                    },
                    { upsert: true }
                );
            } 
            else if (os.status === 'EX') {
                msg = `${techName} iniciou o serviço na O.S. do cliente ${clientName}.`;
                // Registra chegada e calcula tempo de deslocamento
                const hist = await ServiceHistory.findOne({ osId: String(os.id) });
                const arrivalDate = parseIXCDate(os.data_inicio) || new Date();

                if (hist && hist.startTime) {
                    const diffMin = Math.max(0, Math.round((arrivalDate - hist.startTime) / 60000));
                    await ServiceHistory.updateOne({ _id: hist._id }, { arrivalTime: arrivalDate, durationDrive: diffMin });
                } else {
                    await ServiceHistory.findOneAndUpdate(
                        { osId: String(os.id) },
                        { osNumber: os.protocolo, teamId: String(tecnicoId), teamName: techName, client: clientName, subject: subjectName, arrivalTime: arrivalDate },
                        { upsert: true }
                    );
                }
            } 
            else if (os.status === 'F') {
                msg = `${techName} finalizou o serviço na O.S. do cliente ${clientName}.`;
                
                // Usa a data de fechamento real do IXC se disponível, senão usa 'now'
                const completionDate = parseIXCDate(os.data_fechamento) || new Date();
                await ServiceOrder.updateOne({ ixcId: os.id }, { finishedAt: completionDate });
                
                // Finaliza histórico e calcula tempo de atendimento
                const hist = await ServiceHistory.findOne({ osId: String(os.id) });
                if (hist && hist.arrivalTime) {
                    const diffMin = Math.max(0, Math.round((completionDate - hist.arrivalTime) / 60000));
                    await ServiceHistory.updateOne({ _id: hist._id }, { endTime: completionDate, durationService: diffMin });
                } else if (hist) {
                    await ServiceHistory.updateOne({ _id: hist._id }, { endTime: completionDate });
                }
            }

            if (msg && !isInitialSync) {
                await Alert.create({ type: 'Warning', message: msg, device: techName, timestamp: new Date() });
                if (io) io.emit('status_notification', { message: msg, type: os.status, tech: techName });
            }
        }

        // Tradutor de Endereços Inteligente (Premium)
        const reformatAddress = (rawAddr) => {
            if (!rawAddr) return '';
            try {
                // Limpa espaços extras e normaliza
                let clean = rawAddr.replace(/\s+/g, ' ').trim();
                
                // Se o endereço já parecer estar no formato correto (Rua primeiro), não mexe
                const streetKeywords = ['Rua', 'Avenida', 'Av.', 'Travessa', 'Tv.', 'Rodovia', 'Vila', 'Conjunto', 'Alameda', 'Praça'];
                const startsWithStreet = streetKeywords.some(k => clean.toLowerCase().startsWith(k.toLowerCase()));
                if (startsWithStreet && clean.includes(',')) return clean;

                const parts = clean.split(' - ').map(p => p.trim());
                
                // Estratégia: Encontrar qual parte contém a Rua/Avenida
                let streetPartIndex = parts.findIndex(p => streetKeywords.some(k => p.toLowerCase().includes(k.toLowerCase())));
                
                if (streetPartIndex !== -1) {
                    const streetInfo = parts[streetPartIndex];
                    // Remove a parte da rua da lista para processar o resto (Cidade/Bairro)
                    parts.splice(streetPartIndex, 1);
                    
                    let cityInfo = parts.join(' ');
                    // Remove CEP e UF repetidos
                    cityInfo = cityInfo.replace(/\d{5}-\d{3}/g, '').replace(/\bMA\b/g, '').replace(/São Luís/gi, '').replace(/\s+/g, ' ').trim();
                    
                    // O que sobrou geralmente é o bairro
                    const neighborhood = cityInfo.replace(/^[,\-\s]+|[,\-\s]+$/g, '');
                    
                    return `${streetInfo}${neighborhood ? ' - ' + neighborhood : ''}, São Luís - MA`;
                }

                // Fallback para o formato antigo se não achou palavras-chave
                if (parts.length >= 2) {
                    const streetInfo = parts[parts.length - 1];
                    let cityInfo = parts[0].replace(/\d{5}-\d{3}/g, '').trim();
                    const words = cityInfo.split(' ');
                    const uf = words[0].length === 2 ? words[0] : 'MA';
                    const neighborhood = words[words.length - 1];
                    const city = words.slice(uf.length === 2 ? 1 : 0, -1).join(' ') || 'São Luís';
                    
                    return `${streetInfo} - ${neighborhood}, ${city} - ${uf}`;
                }
            } catch (e) {
                return rawAddr;
            }
            return rawAddr;
        };

        const inferCategoryFromSubject = (subj) => {
          if (!subj) return 'Instalação';
          const s = subj.toUpperCase();
          if (s.includes('INSTAL') || s.includes('ATIVAC') || s.includes('ATIVAÇ') || s.includes('NOVO PONTO') || s.includes('ATIVAÇÃO')) return 'Instalação';
          if (s.includes('ROMP') || s.includes('ROMPIMENTO') || s.includes('CABO ROMPIDO') || s.includes('FIBRA ROMPIDA')) return 'Fibra rompida';
          if (s.includes('SEM INTERNET') || s.includes('SEM CONEX') || s.includes('PARADO') || s.includes('LOS') || s.includes('SEM SINAL')) return 'Sem conexão';
          if (s.includes('LENT') || s.includes('OSCIL') || s.includes('LENTO') || s.includes('SINAL FRACO')) return 'Lentidão';
          if (s.includes('MUDAN') || s.includes('ENDEREÇO') || s.includes('ENDERECO') || s.includes('TRANSFER')) return 'Mudança de endereço';
          if (s.includes('CONFIG') || s.includes('ROTEADOR') || s.includes('WIFI') || s.includes('MESH') || s.includes('SENHA')) return 'Configuração de roteador';
          if (s.includes('RETIR') || s.includes('CANCEL') || s.includes('RECOLH')) return 'Retirada de equipamentos';
          return 'Instalação';
        };

        const extractDateStr = (rawDate) => {
          if (!rawDate) return todayISO;
          const clean = String(rawDate).trim();
          const brMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
          const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
          return todayISO;
        };

        const extractTimeInfo = (rawDate) => {
          if (!rawDate) return null;
          const clean = String(rawDate).trim();
          if (clean.includes('0000-00-00')) return null;
          const match = clean.match(/(?:^|\s|T)(\d{2}):(\d{2})/);
          if (match) {
            const h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            if (h !== 0 || m !== 0) {
              return { hour: h, minute: m, timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
            }
          }
          return null;
        };

        const scheduledDateStr = extractDateStr(os.data_agenda || os.data_inicio);
        const startTimeInfo = extractTimeInfo(os.data_agenda || os.data_inicio);
        const endTimeInfo = extractTimeInfo(os.data_agenda_final);

        const category = inferCategoryFromSubject(subjectName);
        const techName = await getTechnicianName(tecnicoId);

        let timeStart = '08:30';
        let timeEnd = '09:30';
        let duration = 60;

        if (startTimeInfo) {
          timeStart = startTimeInfo.timeStr;
          if (endTimeInfo) {
            timeEnd = endTimeInfo.timeStr;
            const startMins = startTimeInfo.hour * 60 + startTimeInfo.minute;
            const endMins = endTimeInfo.hour * 60 + endTimeInfo.minute;
            duration = Math.max(15, endMins - startMins);
          } else {
            const isNotif = (subjectName || '').toUpperCase().includes('NOTIFIC');
            const defaultMins = category === 'Instalação' ? 60 : (isNotif ? 20 : 30);
            duration = defaultMins;
            const endHourDec = startTimeInfo.hour + (startTimeInfo.minute + defaultMins) / 60;
            const endH = String(Math.floor(endHourDec) % 24).padStart(2, '0');
            const endM = String(Math.round((endHourDec % 1) * 60) % 60).padStart(2, '0');
            timeEnd = `${endH}:${endM}`;
          }
        }

        const clientLoginStatus = await getClientLoginStatus(os.id_cliente, os.id_login);

        await ServiceOrder.findOneAndUpdate(
          { ixcId: os.id },
          {
            number: os.protocolo,
            client: clientName,
            address: reformatAddress(os.endereco),
            lat: parseFloat(os.latitude) || 0,
            lng: parseFloat(os.longitude) || 0,
            status: os.status,
            priority: os.prioridade,
            description: os.mensagem,
            subject: subjectName,
            category: category,
            teamId: tecnicoId ? String(tecnicoId) : null,
            collaboratorName: techName,
            scheduledDate: scheduledDateStr,
            scheduledTimeStart: timeStart,
            scheduledTimeEnd: timeEnd,
            durationMinutes: duration,
            loginStatus: clientLoginStatus,
            lastSeen: new Date()
          },
          { upsert: true }
        );
      }));
    }

    // ── LIMPEZA DE O.S. ANTIGAS OU DE OUTROS DIAS ──
    const deletedCount = await ServiceOrder.deleteMany({
      ixcId: { $nin: Array.from(ixcIdsPresent) }
    });
    
    logger.info(`[IXC] Sincronização concluída: ${ixcIdsPresent.size} O.S. agendadas para hoje mantidas. (${deletedCount.deletedCount} de outros dias removidas)`);
    
    logger.info('[IXC] Sincronização de O.S. concluída.');
    lastOSSyncTime = Date.now();
    isInitialSync = false;
    if (io) io.emit('os_synced');
  } catch (error) {
    logger.error('[IXC] Erro na sincronização: %s', error.message);
  }
}

module.exports = { syncIXCServiceOrders, syncIXCTeamCollaborators };
