import { useEffect, useState } from 'react'
import { useDashboardStore } from '@/store/dashboard'
import { fetchTeams, fetchStats, fetchServiceOrders } from '@/services/api'
import { initSocket } from '@/services/socket'

export function useDashboard() {
  const { setTeams, setServiceOrders, setStats } = useDashboardStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [teams, stats, orders] = await Promise.all([
          fetchTeams(),
          fetchStats(),
          fetchServiceOrders(),
        ])
        const teamsMap: Record<string, typeof teams[0]> = {}
        teams.forEach((t) => {
          teamsMap[t.id] = t
        })
        setTeams(teamsMap)
        setStats(stats)
        setServiceOrders(orders)
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
    initSocket()

    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [setTeams, setServiceOrders, setStats])

  return { loading }
}
