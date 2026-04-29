const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the dashboard as static files (same server, same port)
app.use(express.static(path.join(__dirname, '../dashboard')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "DELETE"] }
});

// Indexed by teamId to avoid duplicates on reconnect
let teams = {};
let socketToTeam = {};

function deg2rad(deg) { return deg * (Math.PI / 180); }
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1), dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── REST ENDPOINTS ──
app.delete('/teams/offline', (req, res) => {
  const before = Object.keys(teams).length;
  Object.keys(teams).forEach(id => { if (teams[id].status === 'Offline') delete teams[id]; });
  io.emit('update_teams', teams);
  res.json({ removed: before - Object.keys(teams).length, remaining: Object.keys(teams).length });
});

app.delete('/teams/:teamId', (req, res) => {
  const { teamId } = req.params;
  if (teams[teamId]) { delete teams[teamId]; io.emit('update_teams', teams); res.json({ ok: true }); }
  else res.status(404).json({ error: 'Not found' });
});

app.get('/teams', (req, res) => res.json(teams));

// Health check for EasyPanel
app.get('/health', (req, res) => res.json({ status: 'ok', teams: Object.keys(teams).length }));

// ── WEBSOCKET ──
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  socket.emit('update_teams', teams);

  socket.on('register_team', (data) => {
    const teamId = data.teamId;
    socketToTeam[socket.id] = teamId;

    if (teams[teamId]) {
      teams[teamId].status = 'Online';
      teams[teamId].lastUpdate = new Date();
      console.log(`Team ${teams[teamId].name} reconnected`);
    } else {
      teams[teamId] = {
        id: teamId, name: data.name, status: 'Online',
        lastLocation: null, lastUpdate: new Date(),
        history: [], maxSpeed: 0, totalDistance: 0, stops: []
      };
      console.log(`Team ${data.name} registered`);
    }
    io.emit('update_teams', teams);
  });

  socket.on('update_location', (data) => {
    const teamId = socketToTeam[socket.id];
    if (!teamId || !teams[teamId]) return;

    const team = teams[teamId];
    const now = new Date();
    let speedKmh = 0;

    if (team.lastLocation) {
      const distKm = getDistanceKm(team.lastLocation.lat, team.lastLocation.lng, data.lat, data.lng);
      const timeHours = (now - new Date(team.lastUpdate)) / 3600000;
      if (timeHours > 0) speedKmh = distKm / timeHours;
      team.totalDistance += distKm;
      if (speedKmh < 2 && timeHours > 1 / 60) {
        team.stops.push({ lat: data.lat, lng: data.lng, time: now });
      }
    }

    if (speedKmh > team.maxSpeed && speedKmh < 200) team.maxSpeed = speedKmh;

    const newLoc = { lat: data.lat, lng: data.lng, speed: speedKmh, timestamp: now };
    team.history.push(newLoc);
    if (team.history.length > 500) team.history.shift();

    team.lastLocation = newLoc;
    team.lastUpdate = now;
    team.status = data.status || 'Online';

    io.emit('team_location_update', { socketId: teamId, team });
  });

  socket.on('disconnect', () => {
    const teamId = socketToTeam[socket.id];
    if (teamId && teams[teamId]) {
      teams[teamId].status = 'Offline';
      io.emit('update_teams', teams);
    }
    delete socketToTeam[socket.id];
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
