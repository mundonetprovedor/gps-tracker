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
  warning: 'text-status-warning border-status-warning/30 bg-status-warning/10',
  danger: 'text-destructive border-destructive/30 bg-destructive/10',
  info: 'text-primary border-primary/30 bg-primary/10',
  success: 'text-status-success border-status-success/30 bg-status-success/10',
}

export function AlertSystem() {
  const alerts = useDashboardStore((s) => s.alerts)
  const removeAlert = useDashboardStore((s) => s.removeAlert)

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 space-y-2">
      <AnimatePresence>
        {alerts.slice(0, 5).map((alert) => {
          const Icon = alertIcons[alert.type]
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={`flex items-start gap-3 p-3 rounded-xl border backdrop-blur-xl bg-card/90 shadow-xl ${alertColors[alert.type]}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{alert.message}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 font-semibold">
                  {alert.timestamp.toLocaleTimeString('pt-BR')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 -mr-1 -mt-1"
                onClick={() => removeAlert(alert.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
