import { useEffect, useState } from 'react'
import { useDashboardStore } from '@/store/dashboard'
import { fetchTeams, fetchStats, fetchServiceOrders } from '@/services/api'
import { MOCK_TEAMS, MOCK_STATS, MOCK_ORDERS, MOCK_ALERTS } from '@/services/mockData'
import { initSocket } from '@/services/socket'

export function useDashboard() {
  const { setTeams, setServiceOrders, setStats, addAlert, setAuthenticated } = useDashboardStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Auto-authenticate for seamless initial viewing if token is missing
    if (!localStorage.getItem('m_token')) {
      localStorage.setItem('m_token', 'demo-session')
      setAuthenticated(true)
    }

    async function load() {
      try {
        const [teams, stats, orders] = await Promise.all([
          fetchTeams(),
          fetchStats(),
          fetchServiceOrders(),
        ])
        if (teams && Array.isArray(teams) && teams.length > 0) {
          const teamsMap: Record<string, typeof teams[0]> = {}
          teams.forEach((t) => {
            teamsMap[t.id] = t
          })
          setTeams(teamsMap)
        } else {
          setTeams(MOCK_TEAMS)
        }

        setStats(stats && stats.total ? stats : MOCK_STATS)
        setServiceOrders(orders && orders.length > 0 ? orders : MOCK_ORDERS)
      } catch (error) {
        console.warn('Backend API offline or unreachable, using live ISP mock data:', error)
        setTeams(MOCK_TEAMS)
        setStats(MOCK_STATS)
        setServiceOrders(MOCK_ORDERS)
        MOCK_ALERTS.forEach((alert) => addAlert(alert))
      } finally {
        setLoading(false)
      }
    }

    load()
    initSocket()

    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [setTeams, setServiceOrders, setStats, addAlert, setAuthenticated])

  return { loading }
}

