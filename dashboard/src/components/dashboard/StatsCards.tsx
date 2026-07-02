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
  const stats = {
    onlineTechs: 12,
    attendingTechs: 5,
    drivingTechs: 4,
    stoppedTechs: 2,
    offlineTechs: 3,
    osOpen: 45,
    osDone: 28,
    osProgress: 10,
    osOverdue: 7,
    clientsWaiting: 15,
    avgTime: 42,
    completionRate: 62,
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      <StatCard icon={Wifi} label="Técnicos Online" value={stats.onlineTechs} color="#10b981" trend="up" trendValue="+2" />
      <StatCard icon={Wrench} label="Em Atendimento" value={stats.attendingTechs} color="#f97316" />
      <StatCard icon={MapPin} label="Em Deslocamento" value={stats.drivingTechs} color="#3b82f6" />
      <StatCard icon={PauseCircle} label="Parados" value={stats.stoppedTechs} color="#eab308" />
      <StatCard icon={WifiOff} label="Offline" value={stats.offlineTechs} color="#6b7280" />
      <div className="w-px bg-border self-stretch" />
      <StatCard icon={ClipboardList} label="O.S. Abertas" value={stats.osOpen} color="#8b5cf6" />
      <StatCard icon={CheckCircle2} label="Concluídas" value={stats.osDone} color="#10b981" trend="up" trendValue="83%" />
      <StatCard icon={Clock} label="Em Andamento" value={stats.osProgress} color="#f97316" />
      <StatCard icon={AlertTriangle} label="Atrasadas" value={stats.osOverdue} color="#ef4444" trend="down" trendValue="+3" />
      <StatCard icon={Users} label="Aguardando" value={stats.clientsWaiting} color="#f59e0b" />
      <StatCard icon={Timer} label="T. Médio" value={`${stats.avgTime}min`} color="#06b6d4" />
      <StatCard icon={TrendingUp} label="Conclusão" value={`${stats.completionRate}%`} color="#14b8a6" trend="up" trendValue="5%" />
    </div>
  )
}
