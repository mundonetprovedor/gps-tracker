import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronRight, MapPin, Clock, Wifi } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDashboardStore } from '@/store/dashboard'
import { STATUS_MAP, type ServiceOrder } from '@/types'

const statusFilters = [
  { key: 'urgent', label: 'Urgentes', color: '#ef4444' },
  { key: 'progress', label: 'Em Andamento', color: '#f97316' },
  { key: 'done', label: 'Concluídas', color: '#10b981' },
  { key: 'pending', label: 'Pendentes', color: '#6b7280' },
]

export function OSList() {
  const orders = useDashboardStore((s) => s.serviceOrders)
  const selectedOSId = useDashboardStore((s) => s.selectedOSId)
  const setSelectedOSId = useDashboardStore((s) => s.setSelectedOSId)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = orders

    if (activeFilter === 'urgent') {
      list = list.filter((os) => os.priority === 'alta' || os.status === 'DS')
    } else if (activeFilter === 'progress') {
      list = list.filter((os) => os.status === 'EX' || os.status === 'DS')
    } else if (activeFilter === 'done') {
      list = list.filter((os) => os.status === 'F')
    } else if (activeFilter === 'pending') {
      list = list.filter((os) => os.status === 'A' || os.status === 'AG')
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (os) =>
          os.number.toLowerCase().includes(q) ||
          os.client.toLowerCase().includes(q) ||
          os.address?.toLowerCase().includes(q)
      )
    }

    return list
  }, [orders, search, activeFilter])

  return (
    <div className="h-full flex flex-col bg-card/60 backdrop-blur-sm border border-border rounded-2xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            Ordens de Serviço
          </h3>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg">
            {filtered.length}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar O.S...."
            className="pl-8 h-8 text-xs"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap transition-all ${
                activeFilter === f.key
                  ? 'text-white shadow-sm'
                  : 'text-muted-foreground bg-muted/50 hover:bg-muted'
              }`}
              style={activeFilter === f.key ? { backgroundColor: f.color } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <AnimatePresence>
          {filtered.map((os, i) => (
            <OSListItem
              key={os.ixcId}
              os={os}
              index={i}
              isSelected={selectedOSId === os.ixcId}
              onClick={() => setSelectedOSId(os.ixcId)}
            />
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma O.S. encontrada
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
  const statusInfo = STATUS_MAP[os.status as keyof typeof STATUS_MAP] || {
    label: 'Pendente',
    color: '#6b7280',
    icon: 'clock',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 mb-1.5 border ${
        isSelected
          ? 'bg-primary/10 border-primary/30 shadow-sm'
          : 'bg-transparent border-transparent hover:bg-muted/30 hover:border-border'
      }`}
    >
      <div
        className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: statusInfo.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold">OS {os.number}</span>
          <Badge
            className="text-[9px] px-1.5 py-0 font-bold border-0"
            style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}
          >
            {statusInfo.label}
          </Badge>
        </div>
        <p className="text-xs font-semibold text-foreground truncate mt-0.5">{os.client}</p>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{os.address || 'Sem endereço'}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {os.technology && (
            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5" /> {os.technology}
            </span>
          )}
          {os.distance !== undefined && (
            <span className="text-[9px] text-muted-foreground">
              {os.distance} km
            </span>
          )}
          {os.eta && (
            <span className="text-[9px] flex items-center gap-1 text-muted-foreground">
              <Clock className="w-2.5 h-2.5" /> {os.eta}
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className={`w-4 h-4 mt-2 flex-shrink-0 transition-all ${
          isSelected ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
        }`}
      />
    </motion.div>
  )
}
