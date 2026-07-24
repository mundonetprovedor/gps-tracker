import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Phone,
  Battery,
  Gauge,
  Wifi,
  Car,
  Clock,
  Navigation,
  Users,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useDashboardStore } from '@/store/dashboard'
import { TECH_STATUS_CONFIG, type TechStatus } from '@/types'

export function TechnicianCard() {
  const selectedTeamId = useDashboardStore((s) => s.selectedTeamId)
  const teams = useDashboardStore((s) => s.teams)
  const orders = useDashboardStore((s) => s.serviceOrders)
  const setSelectedTeamId = useDashboardStore((s) => s.setSelectedTeamId)
  const setSelectedOSId = useDashboardStore((s) => s.setSelectedOSId)

  const team = selectedTeamId ? teams[selectedTeamId] : null

  const teamOSList = useMemo(
    () => orders.filter((os) => os.teamId === selectedTeamId || os.teamName?.includes(team?.name || '')),
    [orders, selectedTeamId, team]
  )

  if (!team) return null

  const statusConfig = TECH_STATUS_CONFIG[team.status as TechStatus] || TECH_STATUS_CONFIG['Offline']
  const batteryPercent = team.battery !== undefined ? Math.round(team.battery) : null
  const speed = team.lastLocation?.speed ? Math.round(team.lastLocation.speed) : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-card/90 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl w-84 overflow-hidden"
    >
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/40">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2" style={{ borderColor: statusConfig.color }}>
            <AvatarFallback className="font-extrabold text-white text-xs" style={{ backgroundColor: statusConfig.color }}>
              {team.name?.charAt(0).toUpperCase() || 'T'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-extrabold text-foreground">{team.name}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{team.region || 'Região Metropolitana'}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedTeamId(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {/* Status Pill */}
        <div
          className="flex items-center justify-between p-2 rounded-xl border text-xs font-extrabold"
          style={{ backgroundColor: statusConfig.bg, borderColor: `${statusConfig.color}40`, color: statusConfig.color }}
        >
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusConfig.color }} />
            Status: {statusConfig.label}
          </span>
          {team.activityTimeMinutes !== undefined && (
            <span className="text-[10px] opacity-80">Há {team.activityTimeMinutes}m</span>
          )}
        </div>

        {/* Telemetry info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <InfoItem icon={Users} label="Técnicos" value={team.techs ? team.techs.join(', ') : team.name} />
          <InfoItem icon={Car} label="Veículo" value={`${team.vehicle || 'Carro'} (${team.plate || 'N/I'})`} />
          <InfoItem icon={Gauge} label="Velocidade GPS" value={`${speed} km/h`} />
          <InfoItem icon={Battery} label="Bateria App" value={batteryPercent ? `${batteryPercent}%` : 'N/I'} />
          <InfoItem icon={Phone} label="Telefone" value={team.phone || 'Sem fone'} />
          <InfoItem icon={Wifi} label="Região" value={team.neighborhood || team.city || 'São Luís'} />
        </div>

        <Separator />

        {/* Current Active OS */}
        {team.currentOSId && (
          <div className="bg-secondary/40 border border-border p-2.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-muted-foreground flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-primary" /> O.S. em Atendimento ({teamOSList.length}):
              </span>
              <span className="font-extrabold text-primary">#{team.currentOSId.replace('os-', '')}</span>
            </div>
            <Button
              size="sm"
              variant="link"
              className="p-0 h-auto text-xs font-bold text-primary"
              onClick={() => setSelectedOSId(team.currentOSId || null)}
            >
              Ver Detalhes da O.S. ➔
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-xl">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-primary" /> Útima Posição GPS:</span>
          <span className="font-bold text-foreground">{team.lastSeen || 'Agora'}</span>
        </div>

        <Button className="w-full text-xs font-extrabold gap-2" variant="outline" size="sm">
          <Navigation className="w-3.5 h-3.5" /> Focar no Mapa
        </Button>
      </div>
    </motion.div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold text-muted-foreground uppercase">{label}</p>
        <p className="text-[11px] font-bold truncate text-foreground">{value}</p>
      </div>
    </div>
  )
}
