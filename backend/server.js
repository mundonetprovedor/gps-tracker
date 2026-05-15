require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ── CONFIG & LOGS ──
const logger = require('./src/config/logger');
const { syncIXCServiceOrders } = require('./src/services/ixcService');
const { checkGeofences } = require('./src/services/geofenceService');
const { checkIdleStatus } = require('./src/services/idleService');
const { getRouteETA, getOptimizedRoute } = require('./src/services/etaService');

// ── MODELS ──
const User = require('./src/models/User');
const Team = require('./src/models/Team');
const Location = require('./src/models/Location');
const ServiceOrder = require('./src/models/ServiceOrder');
const Alert = require('./src/models/Alert');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'mundonet-super-secret-key';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/mundonet_gps';

// ── DB CONNECTION ──
mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    logger.info('✅ Conectado ao MongoDB');
    seedAdmin();
  })
  .catch(err => logger.error('❌ Erro MongoDB: %s', err.message));

async function seedAdmin() {
  const adminCount = await User.countDocuments({ username: 'admin' });
  if (adminCount === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({ username: 'admin', password: hashedPassword });
    logger.info('✅ Admin criado (admin/admin123)');
  }
}

// ── AUTH MIDDLEWARE ──
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
};

// ── ROUTES ──
app.use(express.static(path.join(__dirname, '../dashboard')));

app.get('/health', (req, res) => res.send('OK'));

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Login inválido' });
});

app.get('/api/dashboard/stats', auth, async (req, res) => {
  const now = new Date();
  const today = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  today.setUTCHours(3, 0, 0, 0); 
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

  const total = await Team.countDocuments();
  const active = await Team.countDocuments({ status: 'Online' });
  const alerts = await Alert.countDocuments({ read: false });
  const osToday = await ServiceOrder.countDocuments({ 
    lastSeen: { $gte: fifteenMinsAgo }, 
    $or: [
      { status: { $in: ['EX', 'DS'] } },
      { status: { $in: ['AG', 'F', 'EN', 'AS'] }, scheduledDate: { $gte: today, $lt: tomorrow } }
    ]
  });
  const osDone = await ServiceOrder.countDocuments({ status: 'F', scheduledDate: { $gte: today, $lt: tomorrow } });

  res.json({ active, total: Math.max(total, 1), osToday, osDone, alerts });
});

app.get('/api/service-orders', auth, async (req, res) => {
  const now = new Date();
  const today = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  today.setUTCHours(3, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

  const orders = await ServiceOrder.find({
    lastSeen: { $gte: fifteenMinsAgo }, 
    $or: [
      { status: { $in: ['EX', 'DS'] } },
      { status: { $in: ['AG', 'F', 'EN', 'AS'] }, scheduledDate: { $gte: today, $lt: tomorrow } }
    ]
  }).sort({ timestamp: -1 });
  res.json(orders);
});

app.get('/api/teams', auth, async (req, res) => {
  res.json(await Team.find());
});

app.get('/api/activities', auth, async (req, res) => {
  const os = await ServiceOrder.find().sort({ timestamp: -1 }).limit(10).lean();
  const alerts = await Alert.find().sort({ timestamp: -1 }).limit(10).lean();
  const combined = [
    ...os.map(o => ({ type: 'OS', content: `OS ${o.number}`, client: o.client, time: o.timestamp })),
    ...alerts.map(a => ({ type: 'Alert', content: a.message, device: a.device, time: a.timestamp, critical: a.type === 'Critical' }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(combined);
});

app.get('/api/history/:teamId', auth, async (req, res) => {
  const { teamId } = req.params;
  const { start, end } = req.query;
  const filter = { teamId };
  if (start && end) {
    filter.timestamp = { $gte: new Date(start), $lte: new Date(end) };
  }
  const history = await Location.find(filter).sort({ timestamp: 1 });
  res.json(history);
});

app.get('/api/optimize-route/:teamId', auth, async (req, res) => {
  const { teamId } = req.params;
  try {
    const team = await Team.findOne({ id: teamId });
    if (!team || !team.lastLocation) return res.status(404).json({ error: 'Técnico sem localização' });

    // Busca O.S. agendadas
    const orders = await ServiceOrder.find({ 
        teamId: teamId, 
        status: { $in: ['AG', 'A', 'EN', 'AS'] },
        lat: { $ne: 0 },
        lng: { $ne: 0 }
    });

    if (orders.length < 2) return res.json(orders);

    // Prepara os pontos: [Origem, Destino1, Destino2, ...]
    const points = [[team.lastLocation.lat, team.lastLocation.lng]];
    orders.forEach(o => points.push([o.lat, o.lng]));

    const optimizedIndices = await getOptimizedRoute(points);
    
    if (!optimizedIndices) return res.json(orders);

    // Reordena baseado nos índices (pulando o primeiro que é a origem)
    const result = [];
    optimizedIndices.forEach(idx => {
        if (idx > 0) result.push(orders[idx - 1]);
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── TRACCAR INTEGRATION ──
const handleTraccarUpdate = async (req, res) => {
  const data = { ...req.query, ...req.body };
  const id = data.id || data.deviceid || data.uniqueId;
  const lat = data.lat || data.latitude;
  const lon = data.lon || data.lng || data.longitude;
  
  if (!id || !lat || !lon) return res.status(400).send('Missing params');

  const now = new Date();
  const speedNum = (parseFloat(data.speed || 0) * 1.852);
  const updateData = { 
    status: 'Online', 
    lastSeen: now, 
    battery: data.battery || data.level,
    lastLocation: { lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, heading: parseFloat(data.heading || 0), timestamp: now }
  };

  const team = await Team.findOneAndUpdate({ id: String(id) }, updateData, { upsert: true, new: true });
  
  await new Location({ teamId: id, name: team.name, lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, battery: updateData.battery, timestamp: now }).save();
  await checkGeofences(id, parseFloat(lat), parseFloat(lon), io);
  await checkIdleStatus(id, parseFloat(lat), parseFloat(lon), speedNum, io);

  // ── CÁLCULO DE ETA ──
  try {
    const activeOS = await ServiceOrder.findOne({ teamId: String(id), status: 'DS' });
    if (activeOS && activeOS.lat && activeOS.lng) {
      const route = await getRouteETA(parseFloat(lat), parseFloat(lon), activeOS.lat, activeOS.lng);
      if (route) {
        const mins = Math.ceil(route.duration / 60);
        updateData.lastLocation.eta = `${mins} min`;
        await Team.updateOne({ _id: team._id }, { 'lastLocation.eta': updateData.lastLocation.eta });
      }
    } else {
        await Team.updateOne({ _id: team._id }, { 'lastLocation.eta': null });
    }
  } catch (e) { logger.error('[ETA] Erro: %s', e.message); }

  io.emit('update_teams', { [team.id]: { ...team.toObject(), lastLocation: { ...team.lastLocation, ...updateData.lastLocation } } });
  res.send('OK');
};

app.post('/traccar', handleTraccarUpdate);
app.get('/traccar', handleTraccarUpdate);

// ── SERVER & SOCKETS ──
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  logger.info('[Socket] Novo cliente conectado');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Mundonet Fleet rodando na porta ${PORT}`);
  
  // Sincronização Inicial
  setTimeout(() => syncIXCServiceOrders(io), 5000);
  // Sincronização Periódica (5 min)
  setInterval(() => syncIXCServiceOrders(io), 5 * 60 * 1000);
});
