import { io, type Socket } from 'socket.io-client'
import { useDashboardStore } from '@/store/dashboard'

let socket: Socket | null = null

export function initSocket(): Socket {
  if (socket) return socket

  socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  })

  const refreshAll = () => {
    import('@/services/api').then((api) => {
      Promise.all([
        api.fetchServiceOrders(),
        api.fetchStats(),
        api.fetchTeams(),
      ]).then(([orders, stats, teams]) => {
        const store = useDashboardStore.getState()
        if (orders && Array.isArray(orders)) store.setServiceOrders(orders)
        if (stats) store.setStats(stats)
        if (teams && Array.isArray(teams)) {
          const teamsMap: Record<string, typeof teams[0]> = {}
          teams.forEach((t) => {
            teamsMap[t.id] = t
          })
          if (Object.keys(teamsMap).length > 0) {
            store.setTeams(teamsMap)
          }
        }
      }).catch((err) => {
        console.warn('Real-time sync error:', err)
      })
    })
  }

  socket.on('connect', () => {
    console.log('⚡ Socket.io conectado com sucesso!')
    refreshAll()
  })

  socket.on('update_teams', (data) => {
    const store = useDashboardStore.getState()
    store.setTeams({ ...store.teams, ...data })
  })

  socket.on('location_update', (data) => {
    const store = useDashboardStore.getState()
    const team = store.teams[data.teamId]
    if (!team) {
      store.updateTeam(data.teamId, {
        id: data.teamId,
        name: data.name || `Técnico ${data.teamId}`,
        status: (data.status as any) || 'Disponível',
        lastLocation: { lat: data.lat, lng: data.lng, speed: data.speed, heading: data.heading },
        lastSeen: data.lastSeen,
      })
    } else {
      store.updateTeam(data.teamId, {
        ...team,
        ...data,
        lastLocation: { lat: data.lat, lng: data.lng, speed: data.speed, heading: data.heading },
        lastSeen: data.lastSeen,
      })
    }
  })

  socket.on('team_removed', (id) => {
    useDashboardStore.getState().removeTeam(id)
  })

  socket.on('os_synced', () => {
    refreshAll()
  })

  socket.on('status_notification', (data) => {
    const store = useDashboardStore.getState()
    store.addAlert({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: data.type === 'F' ? 'success' : data.type === 'Critical' ? 'danger' : 'warning',
      message: data.message,
      timestamp: new Date(),
    })
    refreshAll()
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

