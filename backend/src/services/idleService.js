const Team = require('../models/Team');
const ServiceOrder = require('../models/ServiceOrder');
const Alert = require('../models/Alert');
const logger = require('../config/logger');

// Raio de tolerância para considerar que está em uma O.S. (200 metros)
const GEOFENCE_RADIUS = 0.2; 
// Tempo para considerar ociosidade (20 minutos)
const IDLE_THRESHOLD_MS = 20 * 60 * 1000;

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

async function checkIdleStatus(teamId, lat, lon, speed, io) {
  try {
    const team = await Team.findOne({ id: String(teamId) });
    if (!team) return;

    const now = new Date();

    // 1. Verificar se está em movimento (> 2 km/h)
    if (speed > 2) {
      if (team.idleStart) {
        logger.info(`[Idle] Técnico ${team.name} voltou a se mover.`);
        team.idleStart = null;
        await team.save();
      }
      return;
    }

    // 2. Se está parado, verificar se já temos o início da ociosidade
    if (!team.idleStart) {
      team.idleStart = now;
      await team.save();
      return;
    }

    // 3. Calcular tempo parado
    const idleDuration = now - team.idleStart;

    if (idleDuration >= IDLE_THRESHOLD_MS) {
      // 4. Verificar se ele está perto de ALGUMA O.S. ativa
      const nearbyOS = await ServiceOrder.findOne({
        status: { $in: ['A', 'DS', 'EX', 'AG'] },
        lat: { $ne: 0 },
        lng: { $ne: 0 }
      }).lean();

      // Busca todas as O.S. e filtra por distância (simplificado para o exemplo)
      // Em produção, usaríamos $near ou $geoWithin do MongoDB
      const allActiveOS = await ServiceOrder.find({
        status: { $in: ['A', 'DS', 'EX', 'AG'] }
      }).lean();

      let isNearAnyOS = false;
      for (const os of allActiveOS) {
        if (os.lat && os.lng) {
          const dist = calculateDistance(lat, lon, os.lat, os.lng);
          if (dist < GEOFENCE_RADIUS) {
            isNearAnyOS = true;
            break;
          }
        }
      }

      // 5. Se estiver parado fora de uma O.S. e ainda não alertamos nesta hora
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      if (!isNearAnyOS && (!team.lastIdleAlertAt || team.lastIdleAlertAt < oneHourAgo)) {
        const minutes = Math.floor(idleDuration / 60000);
        const message = `Alerta: Técnico ${team.name} está parado há ${minutes} min fora de zona de serviço!`;
        
        logger.warn(`[Idle Alert] ${message}`);

        await Alert.create({
          type: 'Critical',
          message: message,
          device: team.name,
          timestamp: now
        });

        team.lastIdleAlertAt = now;
        await team.save();

        if (io) {
          io.emit('status_notification', { message, type: 'Critical' });
          io.emit('os_synced'); // Para atualizar a lista de alertas no dash
        }
      }
    }
  } catch (e) {
    logger.error(`[Idle Service] Erro: ${e.message}`);
  }
}

module.exports = { checkIdleStatus };
