const mongoose = require('mongoose');

const ServiceHistorySchema = new mongoose.Schema({
  osId: { type: String, required: true },
  osNumber: String,
  teamId: { type: String, required: true },
  teamName: String,
  client: String,
  subject: String,
  
  startTime: Date,        // Quando iniciou deslocamento (DS)
  arrivalTime: Date,      // Quando chegou no local (EX)
  endTime: Date,          // Quando finalizou (F)
  
  durationDrive: Number,   // Minutos em deslocamento
  durationService: Number, // Minutos em atendimento
  
  location: {
    lat: Number,
    lng: Number
  },
  
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ServiceHistory', ServiceHistorySchema);
