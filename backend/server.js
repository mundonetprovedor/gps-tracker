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

// ── GLOBAL STATE ──
let teams = {};
let socketToTeam = {};

// ── CONFIG ──
const JWT_SECRET = process.env.JWT_SECRET || 'mundonet-super-secret-key';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/mundonet_gps';

// Desativar buffering para evitar erros de timeout se o banco estiver fora do ar
mongoose.set('bufferCommands', false);

// ── DB CONNECTION ──
const connectWithRetry = () => {
  console.log('Tentando conectar ao MongoDB...');
  mongoose.connect(MONGO_URL, {
    serverSelectionTimeoutMS: 5000, // Timeout após 5s se não encontrar o servidor
  })
  .then(() => console.log('✅ Conectado ao MongoDB com sucesso'))
  .catch(err => {
    console.error('❌ Erro de conexão com MongoDB:', err.message);
    console.log('Nova tentativa em 5 segundos...');
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

// ── SERVE DASHBOARD ──
app.use(express.static(path.join(__dirname, '../dashboard')));

// ── AUTH ENDPOINTS ──
app.post('/auth/login', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Banco de dados offline. Tente novamente em instantes.' });
  }
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Login inválido' });
});

// Route to create initial admin (Access this via browser)
app.get('/auth/setup', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).send('<h1>⏳ Banco de dados em inicialização...</h1><p>Por favor, aguarde alguns segundos e atualize a página.</p>');
  }
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).send('<h1>Sistema já configurado</h1>');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({ username: 'admin', password: hashedPassword });
    res.send('<h1>✅ Admin criado com sucesso!</h1><p>Usuário: admin<br>Senha: admin123</p><a href="/">Ir para o Painel</a>');
  } catch (e) {
    res.status(500).send('<h1>❌ Erro no Banco de Dados</h1><p>Verifique se o MongoDB está rodando no EasyPanel.</p>');
  }
});

// Middleware to protect routes
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
};

// ── DATA ENDPOINTS ──
app.get('/api/history/:teamId', auth, async (req, res) => {
  const { teamId } = req.params;
  const { start, end } = req.query;
  const filter = { teamId };
  if (start && end) filter.timestamp = { $gte: new Date(start), $lte: new Date(end) };
  const history = await Location.find(filter).sort({ timestamp: 1 });
  res.json(history);
});

app.get('/api/teams', auth, async (req, res) => res.json(teams));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState }));

// ── TRACCAR INTEGRATION (OsmAnd Protocol) ──
app.get('/traccar', async (req, res) => {
  // Aceita múltiplos nomes de parâmetros para maior compatibilidade
  const id = req.query.id || req.query.deviceid || req.query.uniqueId;
  const lat = req.query.lat || req.query.latitude;
  const lon = req.query.lon || req.query.lng || req.query.longitude;
  const speed = req.query.speed || req.query.velocity;
  const batt = req.query.batt || req.query.battery || req.query.level;
  const timestamp = req.query.timestamp || req.query.time;
  const heading = req.query.bearing || req.query.heading || req.query.direction;

  console.log(`[Traccar] Tentativa de: ${id} | Lat: ${lat} | Lon: ${lon}`);
  
  if (!id || !lat || !lon) {
    return res.status(400).send('Missing required parameters (id, lat, lon)');
  }

  const teamId = id;
  const now = timestamp ? new Date(parseInt(timestamp) * 1000) : new Date();
  
  // Ensure team exists in RAM state
  if (!teams[teamId]) {
    teams[teamId] = { 
      id: teamId, 
      name: `Device ${teamId}`, 
      status: 'Online', 
      lastUpdate: now,
      history: [],
      stops: []
    };
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lon);
  const speedNum = speed ? parseFloat(speed) : 0;
  const batteryNum = batt ? parseFloat(batt) : 100;
  const headingNum = heading ? parseFloat(heading) : 0;

  // Update RAM state for real-time dashboard
  teams[teamId].lastLocation = { 
    lat: latNum, 
    lng: lngNum, 
    speed: speedNum, 
    heading: headingNum,
    timestamp: now 
  };
  teams[teamId].status = 'Online';
  teams[teamId].battery = batteryNum;
  teams[teamId].network = 'Traccar';
  teams[teamId].lastUpdate = now;

  // Save to Database (History)
  try {
    const log = new Location({
      teamId, 
      name: teams[teamId].name, 
      lat: latNum, 
      lng: lngNum,
      speed: speedNum, 
      battery: batteryNum,
      network: 'Traccar', 
      timestamp: now
    });
    await log.save();
  } catch (e) {
    console.error('DB Save Error from Traccar:', e.message);
  }

  // Notify Dashboard via Socket.io
  io.emit('team_location_update', { socketId: teamId, team: teams[teamId] });
  
  // Also emit update_teams to refresh the sidebar if it's a new device
  io.emit('update_teams', teams);

  res.send('OK');
});

// ── REALTIME STATE (RAM) ──

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  // Enviar lista atual assim que o Dashboard (ou qualquer um) conectar
  socket.emit('update_teams', teams);

  socket.on('register_team', (data) => {
    const teamId = data.teamId;
    socketToTeam[socket.id] = teamId;
    
    if (!teams[teamId]) {
      teams[teamId] = { id: teamId, name: data.name, status: 'Online', lastUpdate: new Date(), history: [], stops: [] };
    } else {
      // ATUALIZAÇÃO: Agora atualiza o nome também, caso tenha mudado no app
      teams[teamId].name = data.name; 
      teams[teamId].status = 'Online';
      teams[teamId].lastUpdate = new Date();
    }
    io.emit('update_teams', teams);
  });

  socket.on('update_location', async (data) => {
    const teamId = socketToTeam[socket.id];
    if (!teamId || !teams[teamId]) return;

    const team = teams[teamId];
    const now = new Date();
    
    // Save to Database (History) - Protected by try/catch
    try {
      const log = new Location({
        teamId, name: team.name, lat: data.lat, lng: data.lng,
        speed: data.speed || 0, battery: data.battery || 100,
        network: data.network || 'Unknown', timestamp: now
      });
      await log.save();
    } catch (e) {
      console.error('DB Save Error: Database not connected');
    }

    // Update RAM state for real-time dashboard
    team.lastLocation = { lat: data.lat, lng: data.lng, timestamp: now };
    team.lastUpdate = now;
    team.status = 'Online';
    team.battery = data.battery;
    team.network = data.network;

    io.emit('team_location_update', { socketId: teamId, team });
  });

  socket.on('disconnect', () => {
    const teamId = socketToTeam[socket.id];
    if (teamId && teams[teamId]) {
      teams[teamId].status = 'Offline';
      io.emit('update_teams', teams);
    }
    delete socketToTeam[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Mundonet Tracker Server running on port ${PORT}`));
