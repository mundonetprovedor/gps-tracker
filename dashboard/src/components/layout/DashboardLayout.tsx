import { useDashboardStore } from '@/store/dashboard'
import { useDashboard } from '@/hooks/useDashboard'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { MapView } from '@/components/dashboard/MapView'
import { OSList } from '@/components/dashboard/OSList'
import { OSDetails } from '@/components/dashboard/OSDetails'
import { TechnicianCard } from '@/components/dashboard/TechnicianCard'
import { QuickFilters } from '@/components/dashboard/QuickFilters'
import { AlertSystem } from '@/components/dashboard/AlertSystem'
import { AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export function DashboardLayout() {
  const { loading } = useDashboard()
  const isAuthenticated = useDashboardStore((s) => s.isAuthenticated)
  const selectedTeamId = useDashboardStore((s) => s.selectedTeamId)

  if (!isAuthenticated) {
    return <TopBar />
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">Carregando painel...</p>
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
          <div className="flex-shrink-0">
            <StatsCards />
          </div>

          <div className="flex-1 flex gap-4 min-h-0">
            <div className="w-48 flex-shrink-0 hidden lg:block">
              <QuickFilters />
            </div>

            <div className="flex-1 flex flex-col min-w-0 relative">
              <MapView />

              <AnimatePresence>
                {selectedTeamId && (
                  <div className="absolute left-4 bottom-4 z-[1000]">
                    <TechnicianCard />
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-80 flex-shrink-0 hidden xl:flex flex-col gap-4">
              <div className="flex-1 min-h-0">
                <OSList />
              </div>
              <div className="h-[280px] flex-shrink-0">
                <OSDetails />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertSystem />
    </div>
  )
}
