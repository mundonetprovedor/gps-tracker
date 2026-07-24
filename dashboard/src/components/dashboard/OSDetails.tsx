import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  UserCheck,
  Share2,
  Signal,
  Wifi,
  Navigation,
  AlertOctagon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDashboardStore } from '@/store/dashboard'
import {
  OS_CATEGORY_CONFIG,
  TECH_STATUS_CONFIG,
  type OSSubjectCategory,
} from '@/types'

export function OSDetails() {
  const selectedOSId = useDashboardStore((s) => s.selectedOSId)
  const setSelectedOSId = useDashboardStore((s) => s.setSelectedOSId)
  const orders = useDashboardStore((s) => s.serviceOrders)
  const teams = useDashboardStore((s) => s.teams)
  const addAlert = useDashboardStore((s) => s.addAlert)

  const os = useMemo(() => orders.find((o) => o.ixcId === selectedOSId), [orders, selectedOSId])

  if (!os) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-card/40 border border-border rounded-2xl text-xs font-semibold text-muted-foreground text-center">
        Selecione uma Ordem de Serviço no mapa ou na lista para visualizar a telemetria completa.
      </div>
    )
  }

  const categoryConfig = OS_CATEGORY_CONFIG[os.category as OSSubjectCategory] || OS_CATEGORY_CONFIG['Sem conexão']
  const assignedTeam = os.teamId ? teams[os.teamId] : null

  const handleCopyTrackingLink = () => {
    const link = `https://isp.app/track/os-${os.number}`
    navigator.clipboard.writeText(link)
    addAlert({
      id: `${Date.now()}`,
      type: 'success',
      title: '🚗 Link de Tracking Copiado!',
      message: `Link 'Uber do Técnico' copiado para a O.S. #${os.number}. Envie via WhatsApp para o cliente.`,
      timestamp: new Date(),
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col bg-card/90 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/40">
        <div className="flex items-center gap-2">
          <Badge
            className="text-[10px] font-extrabold px-2 py-0.5"
            style={{ backgroundColor: `${categoryConfig.color}20`, color: categoryConfig.color, border: `1px solid ${categoryConfig.color}40` }}
          >
            {categoryConfig.badge}
          </Badge>
          <span className="text-xs font-extrabold text-foreground">O.S. #{os.number}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOSId(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {/* Client & Address Info */}
          <div>
            <h4 className="text-sm font-extrabold text-foreground">{os.client}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
              {os.address} {os.neighborhood ? `- ${os.neighborhood}` : ''}
            </p>
            {os.phone && (
              <div className="flex items-center gap-2 mt-2">
                <a
                  href={`tel:${os.phone}`}
                  className="text-[11px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-all"
                >
                  <Phone className="w-3 h-3" /> Ligar ({os.phone})
                </a>
                {os.whatsapp && (
                  <a
                    href={`https://wa.me/${os.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-status-success flex items-center gap-1 bg-status-success/10 px-2 py-1 rounded-lg hover:bg-status-success/20 transition-all"
                  >
                    <MessageSquare className="w-3 h-3" /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Subject & SLA Metrics */}
          <div className="bg-secondary/40 border border-border p-2.5 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Assunto:</span>
              <span className="font-extrabold text-foreground">{os.subject}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Prioridade:</span>
              <span className={`font-extrabold uppercase text-[10px] px-2 py-0.5 rounded-full ${
                os.priority === 'critica' ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-foreground'
              }`}>
                {os.priority}
              </span>
            </div>
            {os.slaRemainingMinutes !== undefined && (
              <div className="flex items-center justify-between border-t border-border/50 pt-2 font-bold">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-primary" /> SLA Restante:
                </span>
                <span className={`text-xs ${os.slaRemainingMinutes < 45 ? 'text-destructive font-extrabold animate-pulse' : 'text-status-warning'}`}>
                  {os.slaRemainingMinutes} minutos
                </span>
              </div>
            )}
          </div>

          {/* CTO & Optical Signal Telemetry */}
          {os.ctoName && (
            <div className="bg-muted/50 border border-border p-2.5 rounded-xl space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between border-b pb-1 text-[11px] font-bold text-foreground">
                <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5 text-primary" /> Telemetria CTO</span>
                <span className="text-muted-foreground">{os.technology || 'GPON'}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Caixa Óptica (CTO):</span>
                <span className="font-bold text-foreground">{os.ctoName}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Porta Splitter:</span>
                <span className="font-bold text-foreground">{os.ctoPort || '04/16'}</span>
              </div>
              {os.rxSignal !== undefined && (
                <div className="flex items-center justify-between text-[11px]">
                  <span>Potência RX Óptica:</span>
                  <span className={`font-bold flex items-center gap-1 ${os.rxSignal < -27 ? 'text-destructive font-extrabold' : 'text-status-success'}`}>
                    <Signal className="w-3 h-3" /> {os.rxSignal} dBm
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Assigned Team & ETA */}
          <div className="border border-border p-2.5 rounded-xl space-y-2 bg-card/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-primary" /> Equipe Responsável:
              </span>
              <span className="text-xs font-extrabold text-foreground">
                {assignedTeam ? assignedTeam.name : os.teamName || 'Não Atribuído'}
              </span>
            </div>

            {assignedTeam && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Status da Equipe:</span>
                <span
                  className="font-bold px-2 py-0.5 rounded-full text-[10px]"
                  style={{
                    backgroundColor: TECH_STATUS_CONFIG[assignedTeam.status]?.bg,
                    color: TECH_STATUS_CONFIG[assignedTeam.status]?.color,
                  }}
                >
                  {assignedTeam.status}
                </span>
              </div>
            )}

            {os.eta && (
              <div className="flex items-center justify-between text-[11px] font-bold text-primary bg-primary/10 p-2 rounded-lg">
                <span className="flex items-center gap-1"><Navigation className="w-3.5 h-3.5" /> ETA de Chegada:</span>
                <span>{os.eta}</span>
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs font-extrabold border-primary/40 hover:bg-primary hover:text-primary-foreground gap-1.5"
              onClick={handleCopyTrackingLink}
            >
              <Share2 className="w-3.5 h-3.5" /> Tracking Assinante
            </Button>
            <Button
              variant="default"
              size="sm"
              className="w-full text-xs font-extrabold gap-1.5"
              onClick={() => {
                addAlert({
                  id: `${Date.now()}`,
                  type: 'info',
                  title: '📢 Notificação de Re-Despacho',
                  message: `Notificação push enviada para o aplicativo da equipe responsável pela O.S. #${os.number}`,
                  timestamp: new Date(),
                })
              }}
            >
              <AlertOctagon className="w-3.5 h-3.5" /> Re-despachar
            </Button>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  )
}
