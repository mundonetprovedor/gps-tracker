const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  type: { type: String, enum: ['Critical', 'Warning'], default: 'Warning' },
  message: String,
  device: String,
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', AlertSchema);
