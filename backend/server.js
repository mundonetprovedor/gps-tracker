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

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String }
});
const User = mongoose.model('User', UserSchema);

const ServiceOrderSchema = new mongoose.Schema({
    number: String,
    teamId: String,
    client: String,
    address: String,
    status: { type: String, enum: ['Concluída', 'Em andamento', 'Pendente', 'Cancelada'], default: 'Pendente' },
    timestamp: { type: Date, default: Date.now }
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
let teams = {};
let socketToTeam = {};

// ── SEED INITIAL DATA (Working truly) ──
async function seedInitialData() {
    try {
        const osCount = await ServiceOrder.countDocuments();
        if (osCount === 0) {
            await ServiceOrder.create([
                { number: '#1234', teamId: 'Equipe Norte 01', client: 'João Silva', address: 'Paço do Lumiar, MA', status: 'Concluída' },
                { number: '#1235', teamId: 'Equipe Centro 01', client: 'Maria Santos', address: 'São Luís, MA', status: 'Em andamento' },
                { number: '#1236', teamId: 'Equipe Sul 01', client: 'Pedro Costa', address: 'São José de Ribamar, MA', status: 'Pendente' }
            ]);
        }
        
        const alertCount = await Alert.countDocuments();
        if (alertCount === 0) {
            await Alert.create([
                { type: 'Critical', message: 'Dispositivo offline há mais de 1h', device: 'Nilson' },
                { type: 'Warning', message: 'Bateria fraca (15%)', device: 'Carro Higor' }
            ]);
        }
    } catch (e) { console.error('Seed Error:', e); }
}

// ── SERVE DASHBOARD ──
app.use(express.static(path.join(__dirname, '../dashboard')));

// ── AUTH ENDPOINTS ──
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
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
    const osToday = await ServiceOrder.countDocuments({ timestamp: { $gte: new Date().setHours(0,0,0,0) } });
    const osDone = await ServiceOrder.countDocuments({ status: 'Concluída', timestamp: { $gte: new Date().setHours(0,0,0,0) } });
    const alerts = await Alert.countDocuments({ read: false });
    
    res.json({
        teamsActive: Object.keys(teams).filter(id => teams[id].status === 'Online').length,
        teamsTotal: Math.max(Object.keys(teams).length, 32), // UI mock values if no real teams
        devicesOnline: Object.keys(teams).filter(id => teams[id].status === 'Online').length,
        devicesTotal: 60,
        osToday,
        osDone,
        alertsCritical: alerts,
        sla: 96
    });
});

app.get('/api/service-orders', auth, async (req, res) => {
    const orders = await ServiceOrder.find().sort({ timestamp: -1 });
    res.json(orders);
});

app.get('/api/alerts', auth, async (req, res) => {
    const alerts = await Alert.find({ read: false }).sort({ timestamp: -1 }).limit(10);
    res.json(alerts);
});

app.get('/api/activities', auth, async (req, res) => {
    // Return last 20 activities (combined OS and Alerts)
    const os = await ServiceOrder.find().sort({ timestamp: -1 }).limit(10).lean();
    const alerts = await Alert.find().sort({ timestamp: -1 }).limit(10).lean();
    
    const combined = [
        ...os.map(o => ({ type: 'OS', content: `OS ${o.number} ${o.status.toLowerCase()}`, client: o.client, time: o.timestamp })),
        ...alerts.map(a => ({ type: 'Alert', content: a.message, device: a.device, time: a.timestamp, critical: a.type === 'Critical' }))
    ].sort((a,b) => new Date(b.time) - new Date(a.time));
    
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

app.get('/api/teams', auth, async (req, res) => res.json(teams));

// ── TRACCAR INTEGRATION ──
const handleTraccarUpdate = async (req, res) => {
  const data = { ...req.query, ...req.body };
  let id = data.id || data.deviceid || data.device_id || data.uniqueId;
  let lat = data.lat || data.latitude;
  let lon = data.lon || data.lng || data.longitude;

  if (data.location && typeof data.location === 'object') {
    const c = data.location.coords || data.location;
    lat = lat || c.lat || c.latitude;
    lon = lon || c.lon || c.longitude;
  }

  let speed = data.speed || data.velocity || data.spd;
  let batt = data.batt || data.battery || data.level;
  let heading = data.bearing || data.heading || data.direction;

  if (data.location && typeof data.location === 'object') {
    const c = data.location.coords || data.location;
    speed = speed || c.speed || c.velocity;
    heading = heading || c.heading || c.bearing;
    const b = data.location.battery || {};
    batt = batt || b.level || b.batt;
  }

  if (batt !== undefined && parseFloat(batt) <= 1 && parseFloat(batt) > 0) batt = parseFloat(batt) * 100;

  const timestamp = data.timestamp || data.time;
  if (!id || !lat || !lon) return res.status(400).send('Missing params');

  const teamId = id;
  const now = timestamp ? (isNaN(timestamp) ? new Date(timestamp) : new Date(parseInt(timestamp) * 1000)) : new Date();
  
  if (!teams[teamId]) {
    teams[teamId] = { id: teamId, name: id, status: 'Online', lastUpdate: now, history: [], stops: [], technicians: [{ name: id, status: 'Online', battery: batt || 100 }] };
  }

  const speedNum = speed ? parseFloat(speed) * 1.852 : 0;
  teams[teamId].lastLocation = { lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, heading: parseFloat(heading || 0), timestamp: now };
  teams[teamId].status = 'Online';
  teams[teamId].battery = batt;
  teams[teamId].lastUpdate = now;

  try {
    await new Location({ teamId, name: teams[teamId].name, lat: parseFloat(lat), lng: parseFloat(lon), speed: speedNum, battery: batt, network: 'Traccar', timestamp: now }).save();
  } catch (e) {}

  io.emit('team_location_update', { socketId: teamId, team: teams[teamId] });
  io.emit('update_teams', teams);
  res.send('OK');
};

app.post('/traccar', handleTraccarUpdate);
app.get('/traccar', handleTraccarUpdate);

// ── REALTIME ──
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  socket.emit('update_teams', teams);
  socket.on('disconnect', () => {
    const teamId = socketToTeam[socket.id];
    if (teamId && teams[teamId]) { teams[teamId].status = 'Offline'; io.emit('update_teams', teams); }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Mundonet Tracker running on port ${PORT}`));
