const mongoose = require('mongoose');

const ServiceOrderSchema = new mongoose.Schema({
  ixcId: { type: String, unique: true },
  number: String,
  teamId: String,
  collaboratorName: String,
  client: String,
  address: String,
  lat: Number,
  lng: Number,
  status: String,
  priority: String,
  description: String,
  subject: String,
  category: String,
  timestamp: { type: Date, default: Date.now },
  scheduledDate: String,
  scheduledTimeStart: String,
  scheduledTimeEnd: String,
  durationMinutes: Number,
  lastSeen: Date
});

module.exports = mongoose.model('ServiceOrder', ServiceOrderSchema);
