import { io, type Socket } from 'socket.io-client'
import { useDashboardStore } from '@/store/dashboard'

let socket: Socket | null = null

export function initSocket(): Socket {
  if (socket?.connected) return socket

  socket = io(window.location.origin)

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
        status: 'Online',
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
    import('@/services/api').then((api) => {
      api.fetchServiceOrders().then((orders) => {
        useDashboardStore.getState().setServiceOrders(orders)
      })
    })
  })

  socket.on('status_notification', (data) => {
    const store = useDashboardStore.getState()
    store.addAlert({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: data.type === 'F' ? 'success' : data.type === 'Critical' ? 'danger' : 'warning',
      message: data.message,
      timestamp: new Date(),
    })
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}
