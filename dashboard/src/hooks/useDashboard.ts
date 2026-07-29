import { useEffect, useState } from 'react'
import { useDashboardStore } from '@/store/dashboard'
import { fetchTeams, fetchStats, fetchServiceOrders } from '@/services/api'
import { MOCK_TEAMS, MOCK_STATS, MOCK_ORDERS, MOCK_ALERTS } from '@/services/mockData'
import { initSocket } from '@/services/socket'

export function useDashboard() {
  const { setTeams, setServiceOrders, setStats, addAlert, setAuthenticated } = useDashboardStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ensure dashboard is active
    setAuthenticated(true)

    async function load() {
      try {
        const [teams, stats, orders] = await Promise.all([
          fetchTeams().catch(() => null),
          fetchStats().catch(() => null),
          fetchServiceOrders().catch(() => null),
        ])

        if (teams && Array.isArray(teams)) {
          const teamsMap: Record<string, typeof teams[0]> = {}
          teams.forEach((t) => {
            teamsMap[t.id] = t
          })
          if (Object.keys(teamsMap).length > 0) {
            setTeams(teamsMap)
          }
        }

        if (stats) setStats(stats)
        if (orders && Array.isArray(orders)) {
          setServiceOrders(orders)
        }
      } catch (err) {
        console.warn('Servidor backend ou IXC indisponível:', err)
        const currentTeams = useDashboardStore.getState().teams
        if (Object.keys(currentTeams).length === 0) {
          setTeams(MOCK_TEAMS)
          setStats(MOCK_STATS)
          setServiceOrders(MOCK_ORDERS)
          MOCK_ALERTS.forEach((alert) => addAlert(alert))
        }
      } finally {
        setLoading(false)
      }
    }

    load()
    initSocket()

    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [setTeams, setServiceOrders, setStats, addAlert, setAuthenticated])

  return { loading }
}


