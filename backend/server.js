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
  id: { type: String, required: true, unique: true },
  name: String,
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
    // 1. Busca apenas os funcionários ATIVOS
    const employeesResponse = await fetch(`${IXC_URL}/funcionarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ixcsoft': 'listar',
        'Authorization': 'Basic ' + Buffer.from(IXC_TOKEN).toString('base64')
      },
      body: JSON.stringify({ 
        qtype: 'funcionarios.ativo', 
        query: 'S', 
        oper: '=', 
        rp: '1000' 
      })
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

    // 2. Busca os vínculos de equipe
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
    const activeTeamIds = new Set();
    
    if (data && data.registros) {
      console.log(`[IXC] Analisando ${data.registros.length} registros de equipe...`);
      for (const f of data.registros) {
        if (activeEmployeeIds.has(String(f.id_funcionario))) {
          const nomeReal = nameMap[f.id_funcionario];
          const idEquipe = String(f.id);
          const idFuncionario = String(f.id_funcionario);

          console.log(`[IXC] Mapeando: ${nomeReal} -> ID Equipe: ${idEquipe}, ID Funcionario: ${idFuncionario}`);
          
          // Registra ambos os IDs apontando para o mesmo nome real
          await Team.findOneAndUpdate({ id: idEquipe }, { name: nomeReal }, { upsert: true });
          await Team.findOneAndUpdate({ id: idFuncionario }, { name: nomeReal }, { upsert: true });
          
          activeTeamIds.add(idEquipe);
          activeTeamIds.add(idFuncionario);
        }
      }
      
      // Limpeza: Só remove se não for nenhum dos IDs ativos (Equipe ou Funcionário)
      const allTeamsInDb = await Team.find({}, 'id');
      for (const t of allTeamsInDb) {
        if (!activeTeamIds.has(t.id) && t.id !== 'Nilson' && t.id !== 'teste') {
          await Team.deleteOne({ id: t.id });
        }
      }
      console.log(`[IXC] Sincronização finalizada. Total de IDs monitorados: ${activeTeamIds.size}`);
    }
  } catch (error) {
    console.error('[IXC] Erro no cruzamento de dados:', error.message);
  }
}

async function syncIXCServiceOrders() {
  await syncIXCTeamCollaborators(); // Mapeia funcionários das equipes com nomes reais
  console.log('[IXC] Iniciando sincronização de O.S...');
  try {
    const body = {
      qtype: 'su_oss_chamado.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '100',
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
      // Prioridade para o responsável direto, depois colaborador, depois técnico
      const tecnicoId = os.id_responsavel || os.id_colaborador || os.id_tecnico;
      
      await ServiceOrder.findOneAndUpdate(
        { ixcId: os.id },
        {
          number: os.protocolo,
          client: os.cliente || os.razao || os.nome || 'Cliente não identificado',
          address: os.endereco || os.endereco_padrao || '',
          lat: parseFloat(os.latitude) || 0,
          lng: parseFloat(os.longitude) || 0,
          status: os.status,
          priority: os.prioridade,
          description: os.mensagem,
          subject: os.id_assunto,
          teamId: tecnicoId ? String(tecnicoId) : null,
          scheduledDate: parseIXCDate(os.data_agenda)
        },
        { upsert: true }
      );
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Marca como offline quem não envia sinal há 2 min
  const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
  await Team.updateMany({ lastUpdate: { $lt: twoMinsAgo } }, { status: 'Offline' });

  const teamsTotal = await Team.countDocuments();
  const teamsActive = await Team.countDocuments({ status: 'Online' });
  
  const alerts = await Alert.countDocuments({ read: false });
  
  // Filtro operacional: 
  // 1. Em andamento (EX, DS)
  // 2. Agendadas para HOJE (AG + scheduledDate)
  // 3. Finalizadas HOJE (F + timestamp)
  const osOperational = await ServiceOrder.countDocuments({ 
    $or: [
      { status: { $in: ['EX', 'DS'] } },
      { status: 'AG', scheduledDate: { $gte: today, $lt: tomorrow } },
      { status: 'F', timestamp: { $gte: today } }
    ]
  });
  
  const osDoneToday = await ServiceOrder.countDocuments({ status: 'F', timestamp: { $gte: today } });
  
  res.json({
    teamsActive,
    teamsTotal: Math.max(teamsTotal, 1),
    devicesOnline: teamsActive,
    devicesTotal: Math.max(teamsTotal, 1),
    osToday: osOperational,
    osDone: osDoneToday,
    alertsCritical: alerts,
    sla: 96
  });
});

app.get('/api/service-orders', auth, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const orders = await ServiceOrder.find({
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
    const openOrders = await ServiceOrder.find({
      status: { $in: ['A', 'DS', 'EN', 'AS', 'AG'] }
    });

    for (const os of openOrders) {
      if (!os.lat || !os.lng) continue;
      const dist = calculateDistance(lat, lon, os.lat, os.lng);
      if (dist < 0.2 && os.status !== 'EX') {
        console.log(`[Geofence] Técnico ${teamId} chegou na OS ${os.number}`);
        os.status = 'EX';
        await os.save();
        await Alert.create({ type: 'Warning', message: `Técnico ${teamId} chegou no cliente ${os.client} (OS ${os.number})`, device: teamId });
        io.emit('os_synced');
      }
    }
  } catch (e) { console.error('[Geofence] Erro:', e); }
}

// ── TRACCAR INTEGRATION ──
const handleTraccarUpdate = async (req, res) => {
  const data = { ...req.query, ...req.body };
  console.log(`[Traccar] Nova requisição recebida:`, JSON.stringify(data));

  // Extração Robusta de Dados (Suporta formatos aninhados e raiz)
  const coords = data.coords || (data.location && data.location.coords) || data.location || data;
  const battery = data.battery || (data.location && data.location.battery) || {};

  let id = data.id || data.deviceid || data.device_id || data.uniqueId;
  let lat = coords.lat || coords.latitude;
  let lon = coords.lon || coords.lng || coords.longitude;
  let speed = coords.speed || coords.velocity || coords.spd || data.speed || data.velocity || data.spd;
  let heading = coords.heading || coords.bearing || coords.direction || data.bearing || data.heading || data.direction;

  // Trata bateria se for objeto ou valor direto
  let batt = battery.level || battery.batt || battery.battery ||
    (typeof data.battery === 'number' ? data.battery : undefined) ||
    data.batt || data.level;

  // Normalização de bateria (0.0 - 1.0 para 0 - 100)
  if (batt !== undefined && parseFloat(batt) <= 1 && parseFloat(batt) > 0) {
    batt = parseFloat(batt) * 100;
  }

  const timestamp = data.timestamp || data.time;
  console.log(`[Traccar] Processado -> ID: ${id}, Lat: ${lat}, Lon: ${lon}, Bateria: ${batt}`);

  if (!id || !lat || !lon) {
    console.error(`[Traccar] Erro: Parâmetros obrigatórios ausentes (ID/Lat/Lon).`);
    return res.status(400).send('Missing params');
  }

  const teamId = id;
  const now = timestamp ? (isNaN(timestamp) ? new Date(timestamp) : new Date(parseInt(timestamp) * 1000)) : new Date();

  const speedNum = speed ? parseFloat(speed) * 1.852 : 0;
  const lastLocation = { lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, heading: parseFloat(heading || 0), timestamp: now };

  const team = await Team.findOneAndUpdate(
    { id: String(teamId) },
    { 
      status: 'Online', 
      lastUpdate: now,
      lastLocation,
      battery: batt,
      $setOnInsert: { name: id }
    },
    { upsert: true, new: true }
  );

  console.log(`[Traccar] Equipe Atualizada: ${team.name || id} (ID: ${teamId}) -> Status: ${team.status}`);

  try {
    await new Location({ teamId, name: team.name, lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, battery: batt, network: 'Traccar', timestamp: now }).save();
  } catch (e) { }

  await checkGeofences(teamId, parseFloat(lat), parseFloat(lon));

  io.emit('team_location_update', { socketId: teamId, team: team });
  
  // Envia a lista completa para garantir que o status Online/Offline reflita no painel na hora
  const allTeams = await Team.find();
  io.emit('update_teams', allTeams);

  res.send('OK');
};

app.post('/traccar', handleTraccarUpdate);
app.get('/traccar', handleTraccarUpdate);

// ── REALTIME ──
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', async (socket) => {
  const teams = await Team.find();
  socket.emit('update_teams', teams);
  socket.on('disconnect', () => {
    // Para persistência, não marcamos como offline no disconnect imediato, 
    // mas sim pelo timeout de 10 min no endpoint de stats.
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Mundonet Tracker running on port ${PORT}`));
