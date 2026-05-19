require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

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
const ServiceHistory = require('./src/models/ServiceHistory');
const Alert = require('./src/models/Alert');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições para diagnóstico de 502
app.use((req, res, next) => {
  logger.info(`[HTTP] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'mundonet-super-secret-key';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/mundonet_gps';

// ── DB CONNECTION ──
mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    logger.info('✅ Conectado ao MongoDB');
    
    // Limpeza de segurança (Roda uma vez no boot para corrigir o bug das datas falsas)
    const result = await ServiceOrder.updateMany({ status: 'F' }, { $set: { finishedAt: null } });
    if (result.modifiedCount > 0) {
      logger.info(`✅ [DB] Limpeza concluída: ${result.modifiedCount} O.S. resetadas.`);
    }

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
// Tenta carregar o dashboard de vários caminhos possíveis em containers
const dashboardPath = path.join(__dirname, '../dashboard');
const localDashboardPath = path.join(__dirname, 'dashboard');

if (require('fs').existsSync(dashboardPath)) {
    app.use(express.static(dashboardPath));
} else {
    app.use(express.static(localDashboardPath));
}

app.get('/health', (req, res) => res.send('OK'));

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Login simples (apenas senha)
  if (!username && password) {
      const masterPassword = process.env.DASHBOARD_PASSWORD || 'mundonet2026';
      if (password === masterPassword) {
          const token = jwt.sign({ id: 'master', username: 'master' }, JWT_SECRET, { expiresIn: '30d' });
          return res.json({ token });
      }
  }

  // Login padrão (admin)
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Senha incorreta ou usuário inválido' });
});

app.get('/api/dashboard/stats', auth, async (req, res) => {
  const now = new Date();
  const today = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  today.setUTCHours(3, 0, 0, 0); 
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const total = await Team.countDocuments();
  const active = await Team.countDocuments({ status: 'Online' });
  const alerts = await Alert.countDocuments({ read: false });
  const osToday = await ServiceOrder.countDocuments({ 
    status: { $in: ['AG', 'DS', 'EX'] },
    scheduledDate: { $gte: today, $lt: tomorrow }
  });
  const osDone = await ServiceOrder.countDocuments({ status: 'F', scheduledDate: { $gte: today, $lt: tomorrow } });

  res.json({ active, total: Math.max(total, 1), osToday, osDone, alerts });
});

app.get('/api/teams', auth, async (req, res) => {
  res.json(await Team.find());
});

app.get('/api/service-orders', auth, async (req, res) => {
  try {
    const now = new Date();
    // Força o fuso de Brasília (UTC-3) para calcular o início e fim do dia
    const brNow = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const start = new Date(brNow.getUTCFullYear(), brNow.getUTCMonth(), brNow.getUTCDate(), 0, 0, 0);
    const end = new Date(brNow.getUTCFullYear(), brNow.getUTCMonth(), brNow.getUTCDate(), 23, 59, 59);
    
    // Busca todos os IDs de equipes válidas para filtrar O.S. sem técnico
    const validTeams = await Team.find({}, 'id');
    const teamIds = validTeams.map(t => t.id);

    const query = {
      $and: [
        { teamId: { $in: teamIds } }, // Somente O.S. atribuídas a técnicos da nossa lista
        {
          $or: [
            { 
              status: { $in: ['AG', 'DS', 'EX'] }, 
              scheduledDate: { $gte: start, $lte: end } 
            },
            { 
              status: 'F', 
              finishedAt: { $gte: start } 
            }
          ]
        }
      ]
    };

    const orders = await ServiceOrder.find(query);
    
    // Diagnóstico detalhado para bater com os 63 do IXC
    const stats = {
      total: orders.length,
      status: {},
      tecnicos: {}
    };
    orders.forEach(o => {
      stats.status[o.status] = (stats.status[o.status] || 0) + 1;
      stats.tecnicos[o.teamId] = (stats.tecnicos[o.teamId] || 0) + 1;
    });
    logger.info(`[STATS] Distribuição das O.S. de hoje:`, JSON.stringify(stats));

    res.json(orders);
  } catch (error) {
    logger.error('[API] Erro ao buscar O.S.: %s', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.get('/api/service-orders/:id/nearest', auth, async (req, res) => {
  try {
    const os = await ServiceOrder.findOne({ ixcId: req.params.id });
    if (!os || !os.lat || !os.lng) return res.status(404).json({ error: 'O.S. não encontrada ou sem coordenadas' });

    const onlineTeams = await Team.find({ status: 'Online' });
    const results = [];

    for (const team of onlineTeams) {
      if (!team.lastLocation?.lat) continue;

      // Cálculo simples de distância em linha reta para triagem inicial
      const dist = Math.sqrt(
        Math.pow(team.lastLocation.lat - os.lat, 2) + 
        Math.pow(team.lastLocation.lng - os.lng, 2)
      );

      results.push({
        id: team.id,
        name: team.name,
        lat: team.lastLocation.lat,
        lng: team.lastLocation.lng,
        dist
      });
    }

    // Ordena por distância e pega os 5 mais próximos para calcular ETA real em paralelo
    results.sort((a, b) => a.dist - b.dist);
    const topCandidates = results.slice(0, 5);
    
    const rankingPromises = topCandidates.map(async (cand) => {
      try {
        const route = await getRouteETA(cand.lat, cand.lng, os.lat, os.lng);
        return {
          name: cand.name,
          distance: route ? (route.distance / 1000).toFixed(1) : (cand.dist * 111).toFixed(1),
          duration: route ? Math.ceil(route.duration / 60) : Math.ceil((cand.dist * 111) * 2), // Estimativa simples se falhar
          hasRoute: !!route
        };
      } catch (err) {
        return {
          name: cand.name,
          distance: (cand.dist * 111).toFixed(1),
          duration: Math.ceil((cand.dist * 111) * 2),
          hasRoute: false
        };
      }
    });

    const finalRanking = await Promise.all(rankingPromises);
    finalRanking.sort((a, b) => {
        const durA = typeof a.duration === 'number' ? a.duration : 999;
        const durB = typeof b.duration === 'number' ? b.duration : 999;
        return durA - durB;
    });

    res.json(finalRanking.slice(0, 3));
  } catch (error) {
    logger.error('[SmartDispatch] Erro: %s', error.message);
    res.status(500).json({ error: 'Erro ao calcular equipes próximas' });
  }
});

app.get('/api/reports/service-history', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = {};
    if (start && end) {
      query.timestamp = { $gte: new Date(start), $lte: new Date(end) };
    }
    const history = await ServiceHistory.find(query).sort({ timestamp: -1 }).limit(100);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

app.get('/api/activities', auth, async (req, res) => {
  const now = new Date();
  const today = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  today.setUTCHours(3, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const os = await ServiceOrder.find({
    status: { $in: ['AG', 'DS', 'EX'] },
    scheduledDate: { $gte: today, $lt: tomorrow }
  }).sort({ timestamp: -1 }).limit(10).lean();
  const alerts = await Alert.find().sort({ timestamp: -1 }).limit(10).lean();
  const combined = [
    ...os.map(o => ({ 
      type: 'OS', 
      content: o.client !== 'Não identificado' ? o.client : (o.subject !== 'Não informado' ? o.subject : `OS ${o.number}`),
      client: o.client, 
      subject: o.subject,
      protocol: o.number,
      time: o.timestamp 
    })),
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
  try {
    const data = { ...req.query, ...req.body };
    logger.info(`[TRACCAR] Requisição recebida - Query: ${JSON.stringify(req.query)} | Body: ${JSON.stringify(req.body)}`);
    
    // 1. Tenta pegar do nível principal ou do objeto 'location'
    let id = data.id || data.deviceid || data.device_id || data.uniqueId || data.location?.extras?.id || data.location?.extras?.device_id || data.device_id;
    let lat = data.lat || data.latitude || data.location?.coords?.latitude;
    let lon = data.lon || data.lng || data.longitude || data.location?.coords?.longitude;

    // 2. Fallback: Se o app mandou tudo dentro do campo "_" (como vimos no log)
    if (data.location?.["_"]) {
        const nestedStr = data.location["_"];
        const params = new URLSearchParams(nestedStr);
        if (!id) id = params.get('id');
        if (!lat) lat = params.get('lat');
        if (!lon) lon = params.get('lon');
    }

    // Se for sinalização de ficar offline voluntariamente
    if (id && (data.offline === 'true' || data.status === 'offline')) {
      const deviceId = String(id);
      logger.info(`[TRACCAR] Marcando dispositivo ${deviceId} como Offline voluntariamente`);
      res.send('OK');
      
      (async () => {
        try {
          const team = await Team.findOneAndUpdate(
            { id: deviceId },
            { status: 'Offline', lastSeen: new Date() },
            { new: true }
          );
          if (team) {
            io.emit('update_teams', { [team.id]: team.toObject() });
          }
        } catch (innerError) {
          logger.error('[TRACCAR-OFFLINE] Erro ao marcar offline: %s', innerError.message);
        }
      })();
      return;
    }

    // 3. Validação final
    if (!id || !lat || !lon) {
      logger.warn('[TRACCAR] 400 - Parâmetros ausentes. ID: %s, Lat: %s, Lon: %s. Recebido: %j', id, lat, lon, data);
      return res.status(400).send('Missing params');
    }

    // Normalização
    const deviceId = String(id);
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    const now = new Date();
    
    // Captura da Bateria (0.55 -> 55%)
    let battery = data.battery || data.level || data.location?.battery?.level || 0;
    const rawBattery = battery;
    if (battery > 0 && battery <= 1) {
        battery = Math.round(battery * 100);
    } else {
        battery = parseFloat(battery) || 0;
    }

    // Velocidade: converte m/s para km/h
    let speedNum = 0;
    if (data.location?.coords?.speed && data.location.coords.speed > 0) {
        speedNum = data.location.coords.speed * 3.6; 
    } else {
        speedNum = (parseFloat(data.speed || 0) * 1.852);
    }

    const heading = data.heading || data.location?.coords?.heading || 0;
    const odometer = data.location?.odometer || data.odometer || 0;
    const activity = data.location?.activity?.type || 'unknown';

    logger.info(`[TRACCAR] Sucesso: Dispositivo ${deviceId} | Lat: ${latitude} | Lon: ${longitude} | Bateria: ${battery}% | Velocidade: ${speedNum.toFixed(1)} km/h`);

    if (deviceId === '8' || deviceId === '9') {
      logger.info(`[DEBUG BRUTO] Dispositivo: ${deviceId} | Dados: %j`, data);
      logger.info(`[BATTERY DEBUG] Dispositivo: ${deviceId}, Bruto: ${rawBattery}, Calculado: ${battery}%`);
    }

    res.send('OK');

    (async () => {
      try {
        const updateData = { 
          status: 'Online', 
          lastSeen: now, 
          battery: battery,
          lastLocation: { 
            lat: latitude, 
            lng: longitude, 
            speed: speedNum, 
            heading: parseFloat(heading), 
            timestamp: now,
            odometer: odometer,
            activity: activity
          }
        };

        const team = await Team.findOneAndUpdate(
          { id: deviceId }, 
          { ...updateData, $setOnInsert: { name: `Dispositivo ${deviceId}` } }, 
          { upsert: true, new: true }
        );
        
        await new Location({ 
          teamId: id, 
          name: team.name, 
          lat: parseFloat(lat), 
          lng: parseFloat(lon), 
          speed: speedNum, 
          battery: battery, 
          timestamp: now 
        }).save();

        await checkGeofences(id, parseFloat(lat), parseFloat(lon), io);
        await checkIdleStatus(id, parseFloat(lat), parseFloat(lon), speedNum, io);

        // ── CÁLCULO DE ETA (Segundo Plano) ──
        const activeOS = await ServiceOrder.findOne({ teamId: String(id), status: 'DS' });
        if (activeOS && activeOS.lat && activeOS.lng) {
          const route = await getRouteETA(parseFloat(lat), parseFloat(lon), activeOS.lat, activeOS.lng);
          if (route) {
            const mins = Math.ceil(route.duration / 60);
            const etaText = `${mins} min`;
            await Team.updateOne({ _id: team._id }, { 'lastLocation.eta': etaText });
            team.lastLocation.eta = etaText;
          }
        } else {
          await Team.updateOne({ _id: team._id }, { 'lastLocation.eta': null });
          team.lastLocation.eta = null;
        }

        io.emit('update_teams', { [team.id]: team.toObject() });
      } catch (innerError) {
        logger.error('[TRACCAR-BG] Erro no processamento secundário: %s', innerError.message);
      }
    })();

  } catch (error) {
    logger.error('[TRACCAR] Erro geral: %s', error.message);
    if (!res.headersSent) res.status(500).send('Internal Error');
  }
};

// Handler para OwnTracks
const handleOwnTracksUpdate = async (req, res) => {
  try {
    const data = req.body;
    const locations = Array.isArray(data) ? data : [data];
    
    logger.info(`[OwnTracks] Recebido: ${JSON.stringify(data)}`);
    
    for (const loc of locations) {
      if (loc._type === 'location') {
        const teamId = loc.username || loc.tid || req.headers['x-limit-u']; 
        
        if (!teamId) {
          logger.warn('[OwnTracks] Localização ignorada: Sem ID de técnico (username ou tid)');
          continue;
        }

        // Tenta buscar o nome do técnico se já existir no banco para não ficar anônimo no painel
        let team = await Team.findOne({ id: String(teamId) });
        let teamName = team ? team.name : `Técnico ${teamId}`;

        const update = {
          lat: loc.lat,
          lng: loc.lon,
          lastSeen: loc.tst ? new Date(loc.tst * 1000) : new Date(),
          status: 'Online',
          name: teamName,
          battery: loc.batt || 100, // Captura a bateria real do OwnTracks
          type: 'vehicle' // Força o ícone de carro/veículo
        };

        // Atualiza técnico
        await Team.findOneAndUpdate({ id: String(teamId) }, update, { upsert: true });
        
        // Salva histórico
        await Location.create({
          teamId: String(teamId),
          lat: loc.lat,
          lng: loc.lon,
          timestamp: update.lastSeen
        });

        io.emit('location_update', { teamId: String(teamId), ...update });
        checkGeofences(String(teamId), loc.lat, loc.lon, io);
      }
    }
    
    // OwnTracks exige um retorno 200 (sucesso) com um array (mesmo que vazio)
    return res.status(200).json([]);
  } catch (error) {
    logger.error('[OwnTracks] Erro crítico: %s', error.message);
    // Mesmo com erro, retornamos 200 para o App não ficar tentando re-enviar e travar
    return res.status(200).json([]);
  }
};

app.post('/api/owntracks', handleOwnTracksUpdate);
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
  // Sincronização Periódica (2 min)
  setInterval(() => syncIXCServiceOrders(io), 2 * 60 * 1000);

  // A cada 5 minutos, verifica técnicos offline por inatividade (mais de 15 min)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const result = await Team.updateMany(
        { lastSeen: { $lt: fifteenMinutesAgo }, status: 'Online' },
        { status: 'Offline' }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[Idle] ${result.modifiedCount} técnicos marcados como Offline por inatividade.`);
        io.emit('os_synced'); // Força refresh no dashboard
      }
    } catch (error) {
      logger.error('[Cron] Erro ao verificar inatividade: %s', error.message);
    }
  });
});
