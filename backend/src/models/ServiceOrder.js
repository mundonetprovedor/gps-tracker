const mongoose = require('mongoose');

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
  scheduledDate: Date,
  lastSeen: Date
});

module.exports = mongoose.model('ServiceOrder', ServiceOrderSchema);
