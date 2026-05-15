const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CONFIG ──
const JWT_SECRET = process.env.JWT_SECRET || 'mundonet-super-secret-key';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/mundonet_gps';

// ── IXC CONFIG ──
const IXC_URL = process.env.IXC_URL || 'https://ixc.mundonetbandalarga.com.br/webservice/v1';
const IXC_TOKEN = process.env.IXC_TOKEN || '156:16cdfe88a309a2505917855121d57c47629ff702cfc3c0dcc81e7540471505c8'; // Formato: 'token:password' em base64 se for Basic Auth

mongoose.set('bufferCommands', false);

// ── DB CONNECTION ──
const connectWithRetry = () => {
  console.log('Tentando conectar ao MongoDB...');
  mongoose.connect(MONGO_URL, {
    serverSelectionTimeoutMS: 5000,
  })
    .then(() => {
      console.log('✅ Conectado ao MongoDB com sucesso');
      seedInitialData();
    })
    .catch(err => {
      console.error('❌ Erro de conexão com MongoDB:', err.message);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// ── MODELS ──
const LocationSchema = new mongoose.Schema({
  teamId: String,
  name: String,
  lat: Number,
  lng: Number,
  speed: Number,
  battery: Number,
  network: String,
  timestamp: { type: Date, default: Date.now }
});
const Location = mongoose.model('Location', LocationSchema);

const TeamSchema = new mongoose.Schema({
  id: String,           // ID Principal (geralmente ID de funcionário)
  teamId: String,       // ID da Equipe no IXC (alias)
  name: String,
  status: { type: String, default: 'Offline' },
  lastLocation: {
    lat: Number,
    lng: Number,
    timestamp: Date,
    speed: Number,
    battery: Number
  },
  battery: Number,
  status: { type: String, default: 'Offline' },
  technicians: [{ name: String, status: String, battery: Number }]
}, { timestamps: true });

const Team = mongoose.model('Team', TeamSchema);

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String }
});
const User = mongoose.model('User', UserSchema);

const ServiceOrderSchema = new mongoose.Schema({
  ixcId: { type: String, unique: true },
  number: String,
  teamId: String,
  client: String,
  address: String,
  lat: Number,
  lng: Number,
  status: String,
  priority: String,
  description: String,
  subject: String,
  timestamp: { type: Date, default: Date.now },
  scheduledDate: Date
});
const ServiceOrder = mongoose.model('ServiceOrder', ServiceOrderSchema);

const AlertSchema = new mongoose.Schema({
  type: { type: String, enum: ['Critical', 'Warning'], default: 'Warning' },
  message: String,
  device: String,
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
const Alert = mongoose.model('Alert', AlertSchema);

// ── GLOBAL REALTIME STATE (RAM) ──
let socketToTeam = {};

// ── SEED INITIAL DATA (Working truly) ──
async function seedInitialData() {
  try {
    // Limpa índices antigos de forma segura após a conexão
    await Team.collection.dropIndex('teamId_1').catch(() => {});

    // Garante que o Admin existe
    const adminCount = await User.countDocuments({ username: 'admin' });
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({ username: 'admin', password: hashedPassword });
      console.log('✅ Usuário Admin criado automaticamente (admin/admin123)');
    }

    const osCount = await ServiceOrder.countDocuments();
    if (osCount === 0) {
      await ServiceOrder.create([
        { number: '100', ixcId: '1', client: 'Exemplo Mundonet', address: 'Av. Litorânea, São Luís', status: 'AG', priority: 'N', lat: -2.4855, lng: -44.2494 },
        { number: '101', ixcId: '2', client: 'Teste Sistema', address: 'Rua do Giz, São Luís', status: 'DS', priority: 'A', lat: -2.5297, lng: -44.3068 }
      ]);
    }

    const alertCount = await Alert.countDocuments();
    if (alertCount === 0) {
      await Alert.create([
        { type: 'Critical', message: 'Dispositivo offline há mais de 1h', device: 'Nilson' },
        { type: 'Warning', message: 'Bateria fraca (15%)', device: 'Carro Higor' }
      ]);
    }

    // Inicia sincronização periódica
    setInterval(syncIXCServiceOrders, 5 * 60 * 1000); // A cada 5 minutos
    syncIXCServiceOrders(); // Primeira execução
  } catch (e) { console.error('Seed Error:', e); }
}

function parseIXCDate(dateStr) {
  if (!dateStr || dateStr.includes('0000-00-00') || dateStr === '') return null;
  // Tenta formato DD/MM/YYYY HH:MM:SS
  const brParts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brParts) {
    const timeParts = dateStr.match(/(\d{2}):(\d{2}):(\d{2})/) || [0, 0, 0, 0];
    return new Date(brParts[3], brParts[2] - 1, brParts[1], timeParts[1], timeParts[2], timeParts[3]);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function syncIXCTeamCollaborators() {
  console.log('[IXC] Cruzando dados de Equipes e Colaboradores...');
  try {
    // 1. Busca funcionários ativos
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
      console.log(`[IXC] ${employeesData.registros.length} funcionários ativos encontrados.`);
      employeesData.registros.forEach(f => { 
        nameMap[f.id] = f.funcionario; 
        activeEmployeeIds.add(String(f.id));
      });
    }

    // 2. Busca vínculos de equipe
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
    const activeIds = new Set();
    
    // Limpeza radical para evitar duplicatas de lógica anterior
    await Team.deleteMany({ id: { $nin: ['Nilson', 'teste'] } });

    if (data && data.registros) {
      console.log(`[IXC] Analisando ${data.registros.length} registros de equipe...`);
      for (const f of data.registros) {
        if (activeEmployeeIds.has(String(f.id_funcionario))) {
          const nomeReal = nameMap[f.id_funcionario];
          const idEquipe = String(f.id);
          const idFuncionario = String(f.id_funcionario);

          console.log(`[IXC] Mapeando: ${nomeReal} -> ID Equipe: ${idEquipe}, ID Funcionario: ${idFuncionario}`);
          
          // Cria UM ÚNICO registro usando o ID de Funcionário como chave principal
          await Team.findOneAndUpdate(
            { id: idFuncionario },
            { 
              name: nomeReal,
              teamId: idEquipe 
            },
            { upsert: true }
          );
          
          activeIds.add(idFuncionario);
        }
      }
      console.log(`[IXC] Sincronização finalizada. ${activeIds.size} técnicos únicos mapeados.`);
    }
  } catch (error) {
    console.error('[IXC] Erro no cruzamento de dados:', error.message);
  }
}

let subjectMap = {};
let clientMap = {};

async function syncIXCClientes() {
  console.log('[IXC] Sincronizando tabela de clientes...');
  try {
    const response = await fetch(`${IXC_URL}/cliente`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({
        qtype: 'cliente.id',
        query: '0',
        oper: '>',
        rp: '5000' // Busca até 5000 clientes recentes
      })
    });
    const data = await response.json();
    if (data && data.registros) {
      data.registros.forEach(r => {
        clientMap[String(r.id)] = r.razao;
      });
      console.log(`[IXC] ${Object.keys(clientMap).length} clientes mapeados.`);
    }
  } catch (e) { console.error('[IXC] Erro ao sincronizar clientes:', e.message); }
}

async function syncIXCAssuntos() {
  console.log('[IXC] Sincronizando tabela de assuntos...');
  try {
    const response = await fetch(`${IXC_URL}/su_oss_assunto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({
        qtype: 'su_oss_assunto.id',
        query: '0',
        oper: '>',
        rp: '1000'
      })
    });
    const data = await response.json();
    if (data && data.registros) {
      data.registros.forEach(r => {
        subjectMap[String(r.id)] = r.assunto;
      });
      console.log(`[IXC] ${Object.keys(subjectMap).length} assuntos mapeados.`);
    }
  } catch (e) { console.error('[IXC] Erro ao sincronizar assuntos:', e.message); }
}

async function syncIXCServiceOrders() {
  await syncIXCTeamCollaborators();
  await syncIXCAssuntos(); 
  await syncIXCClientes();
  console.log('[IXC] Iniciando sincronização de O.S...');
  try {
    const body = {
      qtype: 'su_oss_chamado.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '1000',
      sortname: 'su_oss_chamado.id',
      sortorder: 'desc'
    };

    const response = await fetch(`${IXC_URL}/su_oss_chamado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!data || !data.registros) return;

    for (const os of data.registros) {
      const tecnicoId = os.id_responsavel || os.id_colaborador || os.id_tecnico;
      const assuntoReal = subjectMap[String(os.id_assunto)] || os.assunto || os.id_assunto || 'Não informado';
      
      let clienteReal = clientMap[String(os.id_cliente)];
      
      // Se não achou o cliente no mapa (muitos clientes), busca individualmente
      if (!clienteReal && os.id_cliente) {
        try {
          const cRes = await fetch(`${IXC_URL}/cliente`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ixcsoft': 'listar',
              'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
            },
            body: JSON.stringify({ qtype: 'cliente.id', query: os.id_cliente, oper: '=', rp: '1' })
          });
          const cData = await cRes.json();
          if (cData && cData.registros && cData.registros[0]) {
            clienteReal = cData.registros[0].razao;
            clientMap[String(os.id_cliente)] = clienteReal; // Salva no mapa para a próxima
          }
        } catch (e) { console.error(`[IXC] Erro ao buscar cliente ${os.id_cliente}:`, e.message); }
      }

      if (!clienteReal) clienteReal = os.nome_cliente || os.cliente || os.razao_social || os.razao || os.nome || 'Cliente não identificado';
      
      const oldOS = await ServiceOrder.findOne({ ixcId: os.id });
      
      await ServiceOrder.findOneAndUpdate(
        { ixcId: os.id },
        {
          number: os.protocolo,
          client: clienteReal,
          address: os.endereco || os.endereco_padrao || '',
          lat: parseFloat(os.latitude) || 0,
          lng: parseFloat(os.longitude) || 0,
          status: os.status,
          priority: os.prioridade,
          description: os.mensagem,
          subject: assuntoReal,
          teamId: tecnicoId ? String(tecnicoId) : null,
          scheduledDate: parseIXCDate(os.data_agenda),
          lastSeen: new Date() // Novo campo separado para limpeza
        },
        { upsert: true }
      );

      // Notificações em tempo real se o status mudou
      if (oldOS && oldOS.status !== os.status) {
        const teamName = Object.values(teams).find(t => String(t.id) === String(tecnicoId))?.name || 'Um técnico';
        let message = '';
        const statusLabel = STATUS_MAP[os.status]?.label || os.status;
        
        console.log(`[IXC] Status mudou: OS ${os.id} | ${oldOS.status} -> ${os.status} (${statusLabel})`);

        if (os.status === 'DS') {
            message = `O técnico ${teamName} iniciou o deslocamento para a O.S. do cliente ${clienteReal}.`;
        } else if (os.status === 'EX') {
            message = `O técnico ${teamName} iniciou o serviço na O.S. do cliente ${clienteReal}.`;
        } else {
            message = `O status da O.S. de ${clienteReal} mudou para: ${statusLabel} (${teamName})`;
        }
        
        if (message) {
          io.emit('status_notification', { message, type: os.status });
          console.log(`[Notification] ${message}`);
        }
      }
    }
    console.log(`[IXC] Sincronização concluída: ${data.registros.length} O.S. processadas.`);
    io.emit('os_synced');
  } catch (error) {
    console.error('[IXC] Erro na sincronização:', error.message);
  }
}

// ── SERVE DASHBOARD ──
app.use(express.static(path.join(__dirname, '../dashboard')));

// ── AUTH ENDPOINTS ──
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`[Auth] Tentativa de login: ${username}`);
  const user = await User.findOne({ username });
  if (!user) {
    console.log('[Auth] Usuário não encontrado');
    return res.status(401).json({ error: 'Login inválido' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (user && match) {
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  console.log('[Auth] Senha incorreta');
  res.status(401).json({ error: 'Login inválido' });
});

app.get('/auth/setup', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).send('Sistema já configurado');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({ username: 'admin', password: hashedPassword });
    res.send('✅ Admin criado (admin/admin123)');
  } catch (e) { res.status(500).send('Erro'); }
});

const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
};

// ── DATA ENDPOINTS (PRO) ──
app.get('/api/dashboard/stats', auth, async (req, res) => {
  // Ajuste para Fuso Horário de Brasília (UTC-3)
  const now = new Date();
  const today = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  today.setUTCHours(3, 0, 0, 0); 
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  
  // Marca como offline quem não envia sinal há 2 min
  const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
  await Team.updateMany({ lastSeen: { $lt: twoMinsAgo } }, { status: 'Offline' });

  const total = await Team.countDocuments();
  const active = await Team.countDocuments({ status: 'Online' });
  const alerts = await Alert.countDocuments({ read: false });
  
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  const osToday = await ServiceOrder.countDocuments({ 
    lastSeen: { $gte: fifteenMinsAgo }, // Limpeza por recência
    $or: [
      { status: { $in: ['EX', 'DS'] } },
      { status: 'AG', scheduledDate: { $gte: today, $lt: tomorrow } },
      { status: 'F', timestamp: { $gte: today } }
    ]
  });

  const osDone = await ServiceOrder.countDocuments({ status: 'F', timestamp: { $gte: today } });
  
  res.json({
    active,
    total: Math.max(total, 1),
    osToday,
    osDone,
    alerts
  });
});

app.get('/api/service-orders', auth, async (req, res) => {
  // Ajuste para Fuso Horário de Brasília (UTC-3)
  const now = new Date();
  const today = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  today.setUTCHours(3, 0, 0, 0); // Define como 00:00 no horário local (-3)
  
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

  const orders = await ServiceOrder.find({
    lastSeen: { $gte: fifteenMinsAgo }, 
    $or: [
      { status: { $in: ['EX', 'DS'] } },
      { status: 'AG', scheduledDate: { $gte: today, $lt: tomorrow } },
      { status: 'F', timestamp: { $gte: today } }
    ]
  }).sort({ timestamp: -1 });
  
  res.json(orders);
});

app.get('/api/alerts', auth, async (req, res) => {
  const alerts = await Alert.find({ read: false }).sort({ timestamp: -1 }).limit(10);
  res.json(alerts);
});

app.get('/api/activities', auth, async (req, res) => {
  const statusLabels = { 'A': 'Aberta', 'DS': 'em Deslocamento', 'EX': 'em Execução', 'F': 'Finalizada', 'AG': 'Agendada', 'EN': 'Encaminhada', 'AS': 'Assumida', 'AN': 'em Análise', 'RAG': 'Reagendada' };

  const os = await ServiceOrder.find().sort({ timestamp: -1 }).limit(10).lean();
  const alerts = await Alert.find().sort({ timestamp: -1 }).limit(10).lean();

  const combined = [
    ...os.map(o => ({
      type: 'OS',
      content: `OS ${o.number} ${statusLabels[o.status] || o.status}`,
      client: o.client,
      time: o.timestamp
    })),
    ...alerts.map(a => ({
      type: 'Alert',
      content: a.message,
      device: a.device,
      time: a.timestamp,
      critical: a.type === 'Critical'
    }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  res.json(combined);
});

app.get('/api/history/:teamId', auth, async (req, res) => {
  const { teamId } = req.params;
  const { start, end } = req.query;
  const filter = { teamId };
  if (start && end) filter.timestamp = { $gte: new Date(start), $lte: new Date(end) };
  const history = await Location.find(filter).sort({ timestamp: 1 });
  res.json(history);
});

app.get('/api/teams', auth, async (req, res) => {
  const teams = await Team.find();
  res.json(teams);
});

app.get('/api/debug/ids', auth, async (req, res) => {
  const ids = await ServiceOrder.distinct('teamId');
  res.json(ids);
});

app.delete('/api/teams/:id', auth, async (req, res) => {
  const { id } = req.params;
  console.log(`[Admin] Removendo equipe/dispositivo: ${id}`);
  await Team.deleteOne({ id });
  io.emit('team_removed', id); 
  res.json({ success: true });
});
app.get('/api/admin/clear-alerts', async (req, res) => {
  try {
    const alertsResult = await Alert.deleteMany({});
    const osResult = await ServiceOrder.deleteMany({});
    res.send(`✅ Sistema Limpo! <br> - ${alertsResult.deletedCount} alertas removidos. <br> - ${osResult.deletedCount} ordens de serviço removidas. <br><br> Pode fechar esta aba e atualizar o painel.`);
  } catch (e) { res.status(500).send('Erro ao limpar sistema'); }
});

// ── INTELLIGENCE ──
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function checkGeofences(teamId, lat, lon) {
  try {
    const tech = await Team.findOne({ $or: [{ id: String(teamId) }, { teamId: String(teamId) }] });
    const techName = tech ? tech.name : teamId;

    // Só busca ordens de serviço ATRIBUÍDAS a este técnico
    const myOrders = await ServiceOrder.find({
      teamId: String(teamId),
      status: { $in: ['A', 'DS', 'EN', 'AS', 'AG'] }
    });

    for (const os of myOrders) {
      if (!os.lat || !os.lng) continue;
      const dist = calculateDistance(lat, lon, os.lat, os.lng);
      
      // Se estiver a menos de 200 metros
      if (dist < 0.2 && os.status !== 'EX') {
        console.log(`[Geofence] Chegada Detectada: ${techName} na OS ${os.number}`);
        os.status = 'EX'; // Muda para "Em Execução"
        await os.save();
        
        // Cria o alerta com o nome real do técnico
        await Alert.create({ 
          type: 'Warning', 
          message: `Técnico ${techName} chegou no cliente ${os.client || 'não identificado'} (OS ${os.number})`, 
          device: techName,
          timestamp: new Date()
        });
        
        io.emit('os_synced');
      }
    }
  } catch (e) { console.error('[Geofence] Erro:', e); }
}

// ── TRACCAR INTEGRATION ──
const handleTraccarUpdate = async (req, res) => {
  const data = { ...req.query, ...req.body };
  const coords = data.coords || (data.location && data.location.coords) || data.location || data;
  const battery = data.battery || (data.location && data.location.battery) || {};

  let id = data.id || data.deviceid || data.device_id || data.uniqueId;
  let lat = coords.lat || coords.latitude;
  let lon = coords.lon || coords.lng || coords.longitude;
  let speed = coords.speed || coords.velocity || coords.spd || data.speed || data.velocity || data.spd;
  let heading = coords.heading || coords.bearing || coords.direction || data.bearing || data.heading || data.direction;
  let batt = battery.level || battery.batt || battery.battery || (typeof data.battery === 'number' ? data.battery : undefined) || data.batt || data.level;

  if (batt !== undefined && parseFloat(batt) <= 1 && parseFloat(batt) > 0) batt = parseFloat(batt) * 100;

  const timestamp = data.timestamp || data.time;
  if (!id || !lat || !lon) return res.status(400).send('Missing params');

  const now = timestamp ? (isNaN(timestamp) ? new Date(timestamp) : new Date(parseInt(timestamp) * 1000)) : new Date();
  const speedNum = speed ? parseFloat(speed) * 1.852 : 0;
  const lastLocation = { lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, heading: parseFloat(heading || 0), timestamp: now };

  let team = await Team.findOne({ $or: [{ id: String(id) }, { teamId: String(id) }] });
  const updateData = { status: 'Online', lastSeen: now, lastLocation, battery: batt };

  if (!team) {
    team = await Team.findOneAndUpdate({ id: String(id) }, { ...updateData, $setOnInsert: { name: id } }, { upsert: true, new: true });
  } else {
    await Team.updateOne({ _id: team._id }, updateData);
    team = await Team.findById(team._id);
  }

  try {
    await new Location({ teamId: id, name: team.name, lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, battery: batt, network: 'Traccar', timestamp: now }).save();
    await checkGeofences(id, parseFloat(lat), parseFloat(lon));
  } catch (e) { }

  // Emitir atualização em tempo real (Formato Objeto)
  const allTeamsArray = await Team.find();
  const allTeamsObj = {};
  allTeamsArray.forEach(t => { allTeamsObj[t.id] = t; });
  io.emit('update_teams', allTeamsObj);

  res.send('OK');
};

app.post('/traccar', handleTraccarUpdate);
app.get('/traccar', handleTraccarUpdate);

// ── REALTIME & SERVER ──
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', async (socket) => {
  console.log('[Socket] Novo cliente conectado');
  const teamsArray = await Team.find();
  const teamsObj = {};
  teamsArray.forEach(t => { teamsObj[t.id] = t; });
  socket.emit('update_teams', teamsObj);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mundonet Tracker running on port ${PORT}`);
  // Inicia a primeira sincronização após 5 segundos
  setTimeout(syncIXCServiceOrders, 5000);
  // Sincronização periódica a cada 1 minuto
  setInterval(syncIXCServiceOrders, 60 * 1000);
});
