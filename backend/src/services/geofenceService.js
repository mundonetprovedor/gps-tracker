const Team = require('../models/Team');
const ServiceOrder = require('../models/ServiceOrder');
const Alert = require('../models/Alert');
const logger = require('../config/logger');

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function checkGeofences(teamId, lat, lon, io) {
  try {
    const tech = await Team.findOne({ $or: [{ id: String(teamId) }, { teamId: String(teamId) }] });
    const techName = tech ? tech.name : teamId;

    const myOrders = await ServiceOrder.find({
      teamId: String(teamId),
      status: { $in: ['A', 'DS', 'EN', 'AS', 'AG'] }
    });

    for (const os of myOrders) {
      if (!os.lat || !os.lng) continue;
      const dist = calculateDistance(lat, lon, os.lat, os.lng);
      
      if (dist < 0.2 && os.status !== 'EX') {
        logger.info(`[Geofence] Chegada Detectada: ${techName} na OS ${os.number}`);
        os.status = 'EX';
        await os.save();
        
        await Alert.create({ 
          type: 'Warning', 
          message: `Técnico ${techName} chegou no cliente ${os.client || 'não identificado'} (OS ${os.number})`, 
          device: techName,
          timestamp: new Date()
        });
        
        if (io) io.emit('os_synced');
      }
    }
  } catch (e) { logger.error('[Geofence] Erro: %s', e.message); }
}

module.exports = { checkGeofences };
