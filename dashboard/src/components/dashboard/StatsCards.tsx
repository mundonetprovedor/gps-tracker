import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Wifi,
  Wrench,
  MapPin,
  PauseCircle,
  WifiOff,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Timer,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useDashboardStore } from '@/store/dashboard'

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  trend?: 'up' | 'down'
  trendValue?: string
}

function StatCard({ icon: Icon, label, value, color, trend, trendValue }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-4 py-3 min-w-[140px] flex-shrink-0 hover:border-primary/30 transition-all duration-300 group cursor-default"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}18` }}
      >
        <div className="w-5 h-5 flex items-center justify-center" style={{ color }}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold text-foreground tabular-nums">{value}</span>
          {trend && trendValue && (
            <span
              className={`text-[10px] font-bold flex items-center gap-0.5 ${
                trend === 'up' ? 'text-status-success' : 'text-destructive'
              }`}
            >
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trendValue}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function StatsCards() {
  const storeStats = useDashboardStore((s) => s.stats)
  const teams = useDashboardStore((s) => s.teams)
  const serviceOrders = useDashboardStore((s) => s.serviceOrders)

  const computedStats = useMemo(() => {
    const teamList = Object.values(teams)
    const onlineTechs = storeStats?.active ?? teamList.filter((t) => t.status !== 'Offline').length
    const attendingTechs = teamList.filter((t) => t.status === 'Executando atendimento').length
    const drivingTechs = teamList.filter((t) => t.status === 'Em deslocamento').length
    const stoppedTechs = teamList.filter((t) => t.status === 'Aguardando cliente' || t.status === 'Em intervalo').length
    const offlineTechs = teamList.filter((t) => t.status === 'Offline').length

    const osDone = storeStats?.osDone ?? serviceOrders.filter((o) => o.status === 'F').length
    const osProgress = storeStats?.osProgress ?? serviceOrders.filter((o) => o.status === 'DS' || o.status === 'EX').length
    const osPending = storeStats?.osPending ?? serviceOrders.filter((o) => ['AG', 'A', 'AN', 'EN', 'AS'].includes(o.status)).length
    const osOpen = storeStats?.osToday ?? serviceOrders.length
    const osOverdue = serviceOrders.filter((o) => o.slaRemainingMinutes !== undefined && o.slaRemainingMinutes <= 0).length
    const clientsWaiting = serviceOrders.filter((o) => o.status === 'A' || o.status === 'AG').length
    const avgTime = storeStats?.avgTime ?? 0
    const completionRate = storeStats?.completionRate ?? (osOpen > 0 ? Math.round((osDone / osOpen) * 100) : 0)

    return {
      onlineTechs,
      attendingTechs,
      drivingTechs,
      stoppedTechs,
      offlineTechs,
      osOpen,
      osDone,
      osProgress,
      osPending,
      osOverdue,
      clientsWaiting,
      avgTime,
      completionRate,
    }
  }, [storeStats, teams, serviceOrders])

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      <StatCard icon={Wifi} label="Técnicos Online" value={computedStats.onlineTechs} color="#10b981" />
      <StatCard icon={Wrench} label="Em Atendimento" value={computedStats.attendingTechs} color="#f97316" />
      <StatCard icon={MapPin} label="Em Deslocamento" value={computedStats.drivingTechs} color="#3b82f6" />
      <StatCard icon={PauseCircle} label="Parados" value={computedStats.stoppedTechs} color="#eab308" />
      <StatCard icon={WifiOff} label="Offline" value={computedStats.offlineTechs} color="#6b7280" />
      <div className="w-px bg-border self-stretch" />
      <StatCard icon={ClipboardList} label="O.S. Agendadas" value={computedStats.osOpen} color="#8b5cf6" />
      <StatCard icon={CheckCircle2} label="Concluídas" value={computedStats.osDone} color="#10b981" trend="up" trendValue={`${computedStats.completionRate}%`} />
      <StatCard icon={Clock} label="Em Andamento" value={computedStats.osProgress} color="#f97316" />
      <StatCard icon={AlertTriangle} label="Atrasadas" value={computedStats.osOverdue} color="#ef4444" />
      <StatCard icon={Users} label="Aguardando" value={computedStats.clientsWaiting} color="#f59e0b" />
      <StatCard icon={Timer} label="T. Médio" value={`${computedStats.avgTime}min`} color="#06b6d4" />
      <StatCard icon={TrendingUp} label="Conclusão" value={`${computedStats.completionRate}%`} color="#14b8a6" trend="up" trendValue={`${computedStats.completionRate}%`} />
    </div>
  )
}

