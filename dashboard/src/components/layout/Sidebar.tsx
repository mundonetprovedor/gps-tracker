import { useState } from 'react'
import { motion } from 'framer-motion'
import { useDashboardStore } from '@/store/dashboard'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { id: 'monitor', label: 'Monitoramento', icon: requireLucideIcon('LayoutDashboard') },
  { id: 'history', label: 'Histórico de Rotas', icon: requireLucideIcon('History') },
  { id: 'reports', label: 'Relatórios', icon: requireLucideIcon('BarChart3') },
  { id: 'notifications', label: 'Enviar Notificação', icon: requireLucideIcon('Send') },
]

function requireLucideIcon(name: string): React.ElementType {
  const icons: Record<string, React.ElementType> = {
    LayoutDashboard: ({ className }: { className?: string }) => (
      <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    ),
    History: ({ className }: { className?: string }) => (
      <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ),
    BarChart3: ({ className }: { className?: string }) => (
      <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16v-3"/><path d="M12 16v-7"/><path d="M17 16V8"/></svg>
    ),
    Send: ({ className }: { className?: string }) => (
      <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
    ),
  }
  return icons[name] || (() => null)
}

export function Sidebar() {
  const teams = useDashboardStore((s) => s.teams)
  const stats = useDashboardStore((s) => s.stats)
  const [activeTab, setActiveTab] = useState('monitor')

  const onlineCount = Object.values(teams).filter((t) => t.status === 'Online').length
  const totalCount = Object.values(teams).length

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-border">
        <img src="/mundonet_brand.png" alt="Mundonet" className="h-10" />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-3 mb-4">
          Menu Principal
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="bg-muted/30 rounded-2xl p-4 border border-border">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Online</span>
              <span className="text-status-online">{onlineCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-status-online rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${totalCount > 0 ? (onlineCount / totalCount) * 100 : 0}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Conclusão</span>
              <span className="text-status-success">{stats?.completionRate || 0}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-status-success rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${stats?.completionRate || 0}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
