import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Phone,
  MessageCircle,
  MapPin,
  AlertTriangle,
  Wifi,
  Monitor,
  Play,
  X,
  User,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useDashboardStore } from '@/store/dashboard'
import { STATUS_MAP } from '@/types'

export function OSDetails() {
  const selectedOSId = useDashboardStore((s) => s.selectedOSId)
  const orders = useDashboardStore((s) => s.serviceOrders)
  const setSelectedOSId = useDashboardStore((s) => s.setSelectedOSId)
  const teams = useDashboardStore((s) => s.teams)

  const os = useMemo(
    () => orders.find((o) => o.ixcId === selectedOSId),
    [orders, selectedOSId]
  )

  if (!os) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-card/40 backdrop-blur-sm border border-border rounded-2xl shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
          <Clipboard className="w-6 h-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-semibold">Selecione uma O.S.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Clique em uma ordem para ver os detalhes
        </p>
      </div>
    )
  }

  const statusInfo = STATUS_MAP[os.status as keyof typeof STATUS_MAP] || {
    label: 'Pendente',
    color: '#6b7280',
    icon: 'clock',
  }
  const tech = os.teamId
    ? Object.values(teams).find((t) => t.id === os.teamId || t.name === os.teamId)
    : null

  const dateStr = os.scheduledDate
    ? new Date(os.scheduledDate).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full bg-card/60 backdrop-blur-sm border border-border rounded-2xl overflow-hidden shadow-lg flex flex-col"
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: statusInfo.color }}
          />
          <div>
            <h3 className="text-sm font-extrabold">OS {os.number}</h3>
            <p className="text-[10px] text-muted-foreground font-semibold">{os.client}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOSId(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-2">
          <Badge
            className="font-bold text-xs border-0"
            style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}
          >
            {statusInfo.label}
          </Badge>
          {os.priority === 'alta' && (
            <Badge variant="destructive" className="font-bold text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Urgente
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {os.phone && (
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <Phone className="w-3 h-3" /> Telefone
              </div>
              <p className="text-xs font-semibold">{os.phone}</p>
            </div>
          )}
          {os.whatsapp && (
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <MessageCircle className="w-3 h-3" style={{ color: '#25D366' }} /> WhatsApp
              </div>
              <p className="text-xs font-semibold">{os.whatsapp}</p>
            </div>
          )}
          {os.address && (
            <div className="bg-muted/30 rounded-xl p-3 col-span-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <MapPin className="w-3 h-3" /> Endereço
              </div>
              <p className="text-xs font-semibold">{os.address}</p>
            </div>
          )}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          {tech && (
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <User className="w-3 h-3" /> Técnico
              </div>
              <p className="text-xs font-semibold">{tech.name}</p>
            </div>
          )}
          {os.technology && (
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <Wifi className="w-3 h-3" /> Tecnologia
              </div>
              <p className="text-xs font-semibold">{os.technology}</p>
            </div>
          )}
          {os.equipment && (
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <Monitor className="w-3 h-3" /> Equipamento
              </div>
              <p className="text-xs font-semibold">{os.equipment}</p>
            </div>
          )}
          {dateStr && (
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <Calendar className="w-3 h-3" /> Horário
              </div>
              <p className="text-xs font-semibold">{dateStr}</p>
            </div>
          )}
          {os.delay !== undefined && os.delay > 0 && (
            <div className="bg-destructive/10 rounded-xl p-3 col-span-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-destructive uppercase mb-1">
                <AlertTriangle className="w-3 h-3" /> Atraso
              </div>
              <p className="text-xs font-bold text-destructive">{os.delay} min</p>
            </div>
          )}
          {os.distance !== undefined && (
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                <MapPin className="w-3 h-3" /> Distância
              </div>
              <p className="text-xs font-semibold">{os.distance} km</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Button className="w-full font-extrabold gap-2" size="lg">
          <Play className="w-4 h-4" /> Iniciar Atendimento
        </Button>
      </div>
    </motion.div>
  )
}

function Clipboard({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  )
}
