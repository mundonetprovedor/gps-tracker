import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Phone,
  Battery,
  Gauge,
  Wifi,
  Car,
  CreditCard,
  Clock,
  Navigation,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useDashboardStore } from '@/store/dashboard'

export function TechnicianCard() {
  const selectedTeamId = useDashboardStore((s) => s.selectedTeamId)
  const teams = useDashboardStore((s) => s.teams)
  const orders = useDashboardStore((s) => s.serviceOrders)
  const setSelectedTeamId = useDashboardStore((s) => s.setSelectedTeamId)

  const team = selectedTeamId ? teams[selectedTeamId] : null

  const teamOS = useMemo(
    () => orders.filter((os) => {
      const t = teams[os.teamId || ''] || Object.values(teams).find((x) => x.name === os.teamId || x.id === os.teamId)
      return t?.id === selectedTeamId
    }),
    [orders, teams, selectedTeamId]
  )

  if (!team) return null

  const batteryPercent = team.battery !== undefined ? Math.round(team.battery) : null
  const batteryColor =
    batteryPercent === null
      ? 'text-muted-foreground'
      : batteryPercent < 15
        ? 'text-destructive'
        : batteryPercent < 50
          ? 'text-status-warning'
          : 'text-status-success'
  const speed = team.lastLocation?.speed ? Math.round(team.lastLocation.speed) : 0
  const isOnline = team.status === 'Online'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl w-80 overflow-hidden"
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={team.photo || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
              {team.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-extrabold">{team.name}</p>
            <p className="text-[10px] text-muted-foreground font-semibold">{team.role || 'Técnico de Campo'}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedTeamId(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-status-online animate-pulse-slow' : 'bg-status-offline'}`} />
          <span className={`text-xs font-bold ${isOnline ? 'text-status-online' : 'text-muted-foreground'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InfoItem icon={Battery} label="Bateria" value={batteryPercent !== null ? `${batteryPercent}%` : '--'} color={batteryColor} />
          <InfoItem icon={Gauge} label="Velocidade" value={speed > 0 ? `${speed} km/h` : '0 km/h'} />
          <InfoItem icon={Wifi} label="Conexão" value={team.connectionType || '4G'} />
          <InfoItem icon={Car} label="Veículo" value={team.vehicle || '--'} />
          <InfoItem icon={CreditCard} label="Placa" value={team.plate || '--'} />
          <InfoItem icon={Phone} label="Telefone" value={team.phone || '--'} />
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/30 rounded-xl p-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">O.S.</p>
            <p className="text-sm font-extrabold text-primary">{teamOS.length}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Km Hoje</p>
            <p className="text-sm font-extrabold text-foreground">--</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Parado</p>
            <p className="text-sm font-extrabold text-status-warning">--</p>
          </div>
        </div>

        <div className="bg-muted/20 rounded-xl p-3 space-y-1.5">
          <InfoItem icon={Clock} label="Última Atualização" value={team.lastSeen ? new Date(team.lastSeen).toLocaleTimeString('pt-BR') : '--'} />
          <InfoItem icon={Navigation} label="Tempo Dirigindo" value="--" />
        </div>

        <Button className="w-full font-bold gap-2" variant="secondary" size="sm">
          <MapPin className="w-4 h-4" /> Ver Rota Completa
        </Button>
      </div>
    </motion.div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color || 'text-muted-foreground'}`} />
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-muted-foreground uppercase">{label}</p>
        <p className={`text-xs font-bold truncate ${color?.replace('text-', 'text-') || 'text-foreground'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
