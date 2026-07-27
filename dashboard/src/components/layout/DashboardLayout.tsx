import { useDashboardStore } from '@/store/dashboard'
import { useDashboard } from '@/hooks/useDashboard'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { AlertSystem } from '@/components/dashboard/AlertSystem'
import { AgendaView } from '@/components/dashboard/AgendaView'
import { TechnicianStatusMonitor } from '@/components/dashboard/TechnicianStatusMonitor'
import { Loader2 } from 'lucide-react'

export function DashboardLayout() {
  const { loading } = useDashboard()
  const isAuthenticated = useDashboardStore((s) => s.isAuthenticated)
  const activeTab = useDashboardStore((s) => s.activeTab)

  if (!isAuthenticated) {
    return <TopBar />
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">Carregando painel de monitoramento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
          {activeTab === 'agenda' ? (
            <AgendaView />
          ) : (
            <TechnicianStatusMonitor />
          )}
        </div>
      </div>

      <AlertSystem />
    </div>
  )
}
