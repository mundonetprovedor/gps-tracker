const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  techId: { type: String, required: true }, // 'all' ou um ID de técnico específico
  title: { type: String, required: true },
  body: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: { type: [String], default: [] } // Lista de IDs de técnicos que já receberam a notificação
});

module.exports = mongoose.model('Notification', NotificationSchema);
