import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDashboardStore } from '@/store/dashboard'

const alertIcons = {
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info,
  success: CheckCircle2,
}

const alertColors = {
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-primary/40 bg-primary/10 text-primary',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
}

export function AlertSystem() {
  const alerts = useDashboardStore((s) => s.alerts)
  const removeAlert = useDashboardStore((s) => s.removeAlert)

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-96 space-y-2.5 pointer-events-none">
      <AnimatePresence>
        {alerts.slice(0, 5).map((alert) => {
          const Icon = alertIcons[alert.type] || Info
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-2xl bg-card/95 shadow-2xl ${alertColors[alert.type]}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {alert.title && (
                  <h5 className="text-xs font-extrabold text-foreground mb-0.5">{alert.title}</h5>
                )}
                <p className="text-xs font-semibold text-foreground/90 leading-tight">{alert.message}</p>
                <p className="text-[9px] font-bold text-muted-foreground mt-1">
                  {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 -mt-1 hover:bg-black/20 text-muted-foreground"
                onClick={() => removeAlert(alert.id)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
