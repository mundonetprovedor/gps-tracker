const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // ID do funcionário no IXC
  teamId: String,                   // Alias da equipe
  name: String,
  status: { type: String, default: 'Offline' },
  lastLocation: {
    lat: Number,
    lng: Number,
    timestamp: Date,
    speed: Number,
    battery: Number,
    heading: Number,
    eta: String         // Previsão de chegada formatada (ex: "15 min")
  },
  battery: Number,
  lastSeen: Date,
  idleStart: Date,       // Início do período parado
  lastIdleAlertAt: Date, // Para evitar spam de alertas
}, { timestamps: true });

module.exports = mongoose.model('Team', TeamSchema);
