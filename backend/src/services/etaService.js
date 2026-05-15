const logger = require('../config/logger');

/**
 * Calcula o tempo estimado de chegada usando o OSRM (Gratuito)
 * @param {number} startLat 
 * @param {number} startLon 
 * @param {number} endLat 
 * @param {number} endLon 
 * @returns {Promise<{duration: number, distance: number}>} tempo em segundos, distância em metros
 */
async function getRouteETA(startLat, startLon, endLat, endLon) {
  try {
    // OSRM usa o formato [longitude,latitude]
    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Não foi possível calcular a rota');
    }

    const route = data.routes[0];
    return {
      duration: route.duration, // em segundos
      distance: route.distance  // em metros
    };
  } catch (e) {
    logger.error(`[ETA Service] Erro ao consultar OSRM: ${e.message}`);
    return null;
  }
}

/**
 * Otimiza a sequência de uma lista de pontos (TSP)
 * @param {Array} points [[lat, lon], [lat, lon], ...] - O primeiro ponto deve ser a origem
 */
async function getOptimizedRoute(points) {
    try {
        if (points.length < 2) return points;

        const coords = points.map(p => `${p[1]},${p[0]}`).join(';');
        const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&overview=false`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 'Ok') throw new Error('Erro na otimização');

        // Reordena os pontos baseados no 'waypoint_index' retornado pelo OSRM
        const optimizedIndices = data.waypoints
            .sort((a, b) => a.waypoint_index - b.waypoint_index)
            .map(w => w.trips_index);

        return optimizedIndices; 
    } catch (e) {
        logger.error(`[Optimization Service] Erro: ${e.message}`);
        return null;
    }
}

module.exports = { getRouteETA, getOptimizedRoute };
