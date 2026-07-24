import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronRight, MapPin, Clock, Wifi, ShieldAlert, Signal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDashboardStore } from '@/store/dashboard'
import {
  STATUS_MAP,
  OS_CATEGORY_CONFIG,
  type ServiceOrder,
  type OSSubjectCategory,
} from '@/types'

const categoryFilters: { key: string; label: string; color: string }[] = [
  { key: 'Sem conexão', label: '🔴 Sem Conexão', color: '#EF4444' },
  { key: 'Fibra rompida', label: '🟠 Fibra Rompida', color: '#F97316' },
  { key: 'Lentidão', label: '🟡 Lentidão', color: '#EAB308' },
  { key: 'Instalação', label: '🟢 Instalação', color: '#10B981' },
  { key: 'Mudança de endereço', label: '🔵 Mudança', color: '#3B82F6' },
]

export function OSList() {
  const orders = useDashboardStore((s) => s.serviceOrders)
  const selectedOSId = useDashboardStore((s) => s.selectedOSId)
  const setSelectedOSId = useDashboardStore((s) => s.setSelectedOSId)
  const setSelectedTeamId = useDashboardStore((s) => s.setSelectedTeamId)
  const searchQuery = useDashboardStore((s) => s.searchQuery)
  const [localSearch, setLocalSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = orders

    if (activeCategory) {
      list = list.filter((os) => os.category === activeCategory)
    }

    const query = (localSearch || searchQuery).toLowerCase().trim()
    if (query) {
      list = list.filter(
        (os) =>
          os.number.toLowerCase().includes(query) ||
          os.client.toLowerCase().includes(query) ||
          os.address?.toLowerCase().includes(query) ||
          os.neighborhood?.toLowerCase().includes(query) ||
          os.ctoName?.toLowerCase().includes(query) ||
          os.subject.toLowerCase().includes(query)
      )
    }

    return list
  }, [orders, localSearch, searchQuery, activeCategory])

  return (
    <div className="h-full flex flex-col bg-card/70 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-xl">
      <div className="p-3.5 border-b border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            Ordens de Serviço
          </h3>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg border border-border">
            {filtered.length} O.S.
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por O.S., Cliente, CTO ou Bairro..."
            className="pl-8 h-8 text-xs bg-secondary/50 border-secondary focus:ring-1 focus:ring-primary"
            value={localSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg whitespace-nowrap transition-all ${
              activeCategory === null
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground bg-secondary/50 hover:bg-secondary'
            }`}
          >
            Todas
          </button>
          {categoryFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveCategory(activeCategory === f.key ? null : f.key)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap transition-all ${
                activeCategory === f.key
                  ? 'text-white shadow-sm shadow-black/30'
                  : 'text-muted-foreground bg-secondary/50 hover:bg-secondary'
              }`}
              style={activeCategory === f.key ? { backgroundColor: f.color } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        <AnimatePresence>
          {filtered.map((os, i) => (
            <OSListItem
              key={os.ixcId}
              os={os}
              index={i}
              isSelected={selectedOSId === os.ixcId}
              onClick={() => {
                setSelectedOSId(os.ixcId)
                if (os.teamId) setSelectedTeamId(os.teamId)
              }}
            />
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-xs font-semibold text-muted-foreground flex flex-col items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-muted-foreground/50" />
            Nenhuma Ordem de Serviço encontrada
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function OSListItem({
  os,
  index,
  isSelected,
  onClick,
}: {
  os: ServiceOrder
  index: number
  isSelected: boolean
  onClick: () => void
}) {
  const categoryConfig = OS_CATEGORY_CONFIG[os.category as OSSubjectCategory] || OS_CATEGORY_CONFIG['Sem conexão']
  const statusInfo = STATUS_MAP[os.status as keyof typeof STATUS_MAP] || {
    label: 'Aberto',
    color: '#3b82f6',
  }

  const isOverdue = os.slaRemainingMinutes !== undefined && os.slaRemainingMinutes <= 30

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className={`group flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all duration-200 mb-1.5 border ${
        isSelected
          ? 'bg-primary/15 border-primary/50 shadow-md shadow-primary/10'
          : 'bg-card/40 border-border/40 hover:bg-secondary/60 hover:border-border'
      }`}
    >
      <div
        className="w-1.5 h-12 rounded-full flex-shrink-0 mt-0.5 transition-all group-hover:scale-y-110"
        style={{ backgroundColor: categoryConfig.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-foreground">O.S. #{os.number}</span>
            <Badge
              className="text-[9px] px-1.5 py-0 font-extrabold border-0"
              style={{ backgroundColor: `${categoryConfig.color}20`, color: categoryConfig.color }}
            >
              {os.category}
            </Badge>
          </div>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: `${statusInfo.color}15`, color: statusInfo.color }}
          >
            {statusInfo.label}
          </span>
        </div>

        <p className="text-xs font-semibold text-foreground truncate mt-0.5">{os.client}</p>

        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0 text-muted-foreground/70" />
            <span className="truncate">{os.address || 'Sem endereço'}</span>
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-border/30 text-[10px]">
          {os.ctoName && (
            <span className="flex items-center gap-1 font-mono text-muted-foreground">
              <Wifi className="w-3 h-3 text-primary" /> {os.ctoName}
            </span>
          )}

          {os.rxSignal !== undefined && (
            <span className={`flex items-center gap-1 font-bold ${os.rxSignal < -27 ? 'text-destructive' : 'text-status-success'}`}>
              <Signal className="w-3 h-3" /> {os.rxSignal} dBm
            </span>
          )}

          {os.slaRemainingMinutes !== undefined && (
            <span className={`font-bold flex items-center gap-0.5 ${isOverdue ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>
              <Clock className="w-3 h-3" /> {os.slaRemainingMinutes}m
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className={`w-4 h-4 mt-3 flex-shrink-0 transition-all ${
          isSelected ? 'text-primary translate-x-0.5' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
        }`}
      />
    </motion.div>
  )
}
