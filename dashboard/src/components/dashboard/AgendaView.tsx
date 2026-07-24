import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboardStore } from '@/store/dashboard'
import type { ServiceOrder, OSSubjectCategory } from '@/types'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  User,
  MapPin,
  Wrench,
  Menu,
  X
} from 'lucide-react'

// Hours in time grid (06:00 to 21:00 inclusive = 16 hours)
const START_HOUR = 6
const END_HOUR = 21
const TOTAL_HOURS = END_HOUR - START_HOUR + 1
const HOURS_ARRAY = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i)

// Color scheme mapping for categories in the timeline blocks (matching reference image)
const CATEGORY_STYLE_MAP: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  'Instalação': { bg: 'bg-emerald-500/15 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/40', bar: 'bg-emerald-500' },
  'Sem conexão': { bg: 'bg-rose-500/15 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/40', bar: 'bg-rose-500' },
  'Fibra rompida': { bg: 'bg-orange-500/15 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/40', bar: 'bg-orange-500' },
  'Lentidão': { bg: 'bg-amber-500/15 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/40', bar: 'bg-amber-500' },
  'Mudança de endereço': { bg: 'bg-purple-500/15 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/40', bar: 'bg-purple-500' },
  'Configuração de roteador': { bg: 'bg-sky-500/15 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/40', bar: 'bg-sky-500' },
  'Retirada de equipamentos': { bg: 'bg-slate-500/15 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/40', bar: 'bg-slate-400' },
  'CANCELADO': { bg: 'bg-slate-400/20 dark:bg-slate-800/40', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-400/40', bar: 'bg-slate-400' },
}

function getCategoryStyle(category: string, subject: string) {
  if (subject && subject.toUpperCase().includes('CANCEL')) {
    return CATEGORY_STYLE_MAP['CANCELADO']
  }
  return CATEGORY_STYLE_MAP[category] || {
    bg: 'bg-indigo-500/15 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/40',
    bar: 'bg-indigo-500',
  }
}

// Convert "08:30" string to decimal hours (8.5)
function timeStringToDecimal(timeStr?: string): number {
  if (!timeStr) return 8.0
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) + (m || 0) / 60
}

export function AgendaView() {
  const teams = useDashboardStore((s) => s.teams)
  const serviceOrders = useDashboardStore((s) => s.serviceOrders)
  const agendaViewMode = useDashboardStore((s) => s.agendaViewMode)
  const setAgendaViewMode = useDashboardStore((s) => s.setAgendaViewMode)
  const selectedAgendaDate = useDashboardStore((s) => s.selectedAgendaDate)
  const setSelectedAgendaDate = useDashboardStore((s) => s.setSelectedAgendaDate)
  const setSelectedOSId = useDashboardStore((s) => s.setSelectedOSId)
  const setActiveTab = useDashboardStore((s) => s.setActiveTab)
  const reassignOSSchedule = useDashboardStore((s) => s.reassignOSSchedule)
  const addNewOSSchedule = useDashboardStore((s) => s.addNewOSSchedule)

  const [colabSearch, setColabSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [selectedOS, setSelectedOS] = useState<ServiceOrder | null>(null)
  const [hoveredOS, setHoveredOS] = useState<ServiceOrder | null>(null)
  const [showNewOSModal, setShowNewOSModal] = useState(false)

  // New OS Form state
  const [newClient, setNewClient] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newCategory, setNewCategory] = useState<OSSubjectCategory>('Instalação')
  const [newColabId, setNewColabId] = useState('')
  const [newStartTime, setNewStartTime] = useState('09:00')
  const [newEndTime, setNewEndTime] = useState('10:00')

  // Date formatted display e.g. "24 de julho de 2026"
  const formattedDateString = useMemo(() => {
    try {
      const [year, month, day] = selectedAgendaDate.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return selectedAgendaDate
    }
  }, [selectedAgendaDate])

  // Filtered Collaborators
  const collaboratorsList = useMemo(() => {
    const list = Object.values(teams)
    if (!colabSearch.trim()) return list
    return list.filter((c) => c.name.toLowerCase().includes(colabSearch.toLowerCase()))
  }, [teams, colabSearch])

  // Group service orders by collaborator / teamId
  const ordersByColab = useMemo(() => {
    const map: Record<string, ServiceOrder[]> = {}
    serviceOrders.forEach((os) => {
      if (categoryFilter !== 'ALL' && os.category !== categoryFilter) return
      const colabId = os.teamId || 'colab-unassigned'
      if (!map[colabId]) map[colabId] = []
      map[colabId].push(os)
    })
    return map
  }, [serviceOrders, categoryFilter])

  // Current time line calculation
  const now = new Date()
  const currentDecimalHour = now.getHours() + now.getMinutes() / 60
  const currentTimePercent = Math.max(
    0,
    Math.min(100, ((currentDecimalHour - START_HOUR) / TOTAL_HOURS) * 100)
  )

  const handleCreateNewOS = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClient.trim()) return

    const colabObj = Object.values(teams).find((t) => t.id === newColabId)
    const newOs: ServiceOrder = {
      ixcId: `os-${Date.now()}`,
      number: `${Math.floor(10000 + Math.random() * 90000)}`,
      client: newClient,
      address: 'Rua Principal, 100',
      neighborhood: 'Centro',
      city: 'São Luís',
      subject: newSubject || newCategory,
      category: newCategory,
      priority: 'media',
      status: 'AG',
      scheduledDate: selectedAgendaDate,
      scheduledTimeStart: newStartTime,
      scheduledTimeEnd: newEndTime,
      durationMinutes: Math.round((timeStringToDecimal(newEndTime) - timeStringToDecimal(newStartTime)) * 60),
      teamId: newColabId || undefined,
      collaboratorName: colabObj?.name || 'Sem Colaborador Vinculado'
    }

    addNewOSSchedule(newOs)
    setShowNewOSModal(false)
    setNewClient('')
    setNewSubject('')
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden border border-border/40 rounded-2xl shadow-xl">
      {/* HEADER / TOOLBAR (Exact replica of reference UI layout) */}
      <header className="h-16 px-4 border-b border-border/60 bg-card/70 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0">
        {/* Left: Sidebar Toggle, Hoje Button, Date Navigator */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-all">
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => setSelectedAgendaDate('2026-07-24')}
            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            Hoje
          </button>

          {/* Date Picker Component */}
          <div className="flex items-center gap-1 bg-muted/40 border border-border/50 rounded-xl px-2 py-1">
            <button
              onClick={() => {
                const [y, m, d] = selectedAgendaDate.split('-').map(Number)
                const prev = new Date(y, m - 1, d - 1)
                setSelectedAgendaDate(prev.toISOString().split('T')[0])
              }}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition"
              title="Dia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold capitalize text-foreground min-w-[150px] text-center">
                {formattedDateString}
              </span>
            </div>

            <button
              onClick={() => {
                const [y, m, d] = selectedAgendaDate.split('-').map(Number)
                const next = new Date(y, m - 1, d + 1)
                setSelectedAgendaDate(next.toISOString().split('T')[0])
              }}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition"
              title="Próximo dia"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Search & Quick Category Filter */}
        <div className="hidden md:flex items-center gap-2">
          <div className="relative w-48 lg:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={colabSearch}
              onChange={(e) => setColabSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/40 border border-border/50 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-muted/40 border border-border/50 rounded-xl text-foreground focus:outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            <option value="Instalação">🟢 Instalação</option>
            <option value="Sem conexão">🔴 Sem Conexão</option>
            <option value="Lentidão">🟡 Lentidão</option>
            <option value="Mudança de endereço">🟣 Mudança</option>
            <option value="Configuração de roteador">🔵 Configuração</option>
          </select>
        </div>

        {/* Right: View Mode Selector Tabs (Dia/Hora, Dia/Colaborador, 3 dias, Semana, Mês) */}
        <div className="flex items-center gap-2">
          <div className="bg-muted/50 p-1 rounded-xl border border-border/60 flex items-center gap-0.5 text-xs font-semibold">
            <button
              onClick={() => setAgendaViewMode('diaHora')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                agendaViewMode === 'diaHora'
                  ? 'bg-primary text-primary-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dia/Hora
            </button>
            <button
              onClick={() => setAgendaViewMode('diaColaborador')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                agendaViewMode === 'diaColaborador'
                  ? 'bg-primary text-primary-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dia/Colaborador
            </button>
            <button
              onClick={() => setAgendaViewMode('3dias')}
              className={`hidden sm:block px-3 py-1.5 rounded-lg transition-all ${
                agendaViewMode === '3dias'
                  ? 'bg-primary text-primary-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              3 dias
            </button>
            <button
              onClick={() => setAgendaViewMode('semana')}
              className={`hidden md:block px-3 py-1.5 rounded-lg transition-all ${
                agendaViewMode === 'semana'
                  ? 'bg-primary text-primary-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setAgendaViewMode('mes')}
              className={`hidden lg:block px-3 py-1.5 rounded-lg transition-all ${
                agendaViewMode === 'mes'
                  ? 'bg-primary text-primary-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mês
            </button>
          </div>

          <button
            onClick={() => setShowNewOSModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-emerald-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova O.S.</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {/* DIA / HORA VIEW MODE (Exact replica of reference schedule timeline grid) */}
        {agendaViewMode === 'diaHora' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* TIMELINE GRID CONTAINER WITH HORIZONTAL & VERTICAL SCROLL */}
            <div className="flex-1 overflow-auto relative custom-scrollbar">
              <table className="w-full border-collapse min-w-[1200px]">
                {/* Table Header: Colaboradores column & Hour columns (06 to 21) */}
                <thead className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
                  <tr>
                    {/* Left Header Cell: Colaboradores */}
                    <th className="sticky left-0 z-40 bg-card border-r border-border p-3 text-left w-64 min-w-[256px] shadow-sm">
                      <div className="flex items-center justify-between text-xs font-extrabold tracking-wide uppercase text-primary">
                        <span>Colaboradores</span>
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
                          {collaboratorsList.length}
                        </span>
                      </div>
                    </th>

                    {/* Time Grid Header Columns (06, 07, 08, ..., 21) */}
                    {HOURS_ARRAY.map((hour) => (
                      <th
                        key={hour}
                        className="p-2 border-r border-border/40 text-center text-xs font-bold text-muted-foreground w-[calc((100%-256px)/16)] min-w-[64px] bg-muted/20"
                      >
                        {String(hour).padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Table Body: Collaborator Rows with Scheduled OS Event Blocks */}
                <tbody className="divide-y divide-border/40">
                  {collaboratorsList.map((colab) => {
                    const colabOrders = ordersByColab[colab.id] || []

                    return (
                      <tr key={colab.id} className="hover:bg-muted/20 transition-colors group h-14">
                        {/* Sticky Collaborator Name Cell */}
                        <td className="sticky left-0 z-20 bg-card group-hover:bg-muted/30 border-r border-border p-2.5 w-64 min-w-[256px] shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-bold truncate text-foreground uppercase tracking-tight">
                                {colab.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    colab.status === 'Offline'
                                      ? 'bg-slate-400'
                                      : colab.status === 'Disponível'
                                      ? 'bg-emerald-500 animate-pulse'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {colab.vehicle ? `${colab.vehicle}` : colab.status}
                                </span>
                              </div>
                            </div>

                            {colabOrders.length > 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-muted text-muted-foreground">
                                {colabOrders.length} OS
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Timeline Cell spanning the entire day */}
                        <td colSpan={TOTAL_HOURS} className="p-0 relative h-14 bg-card/40">
                          {/* Hour & Half-hour Background Vertical Grid Lines */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {HOURS_ARRAY.map((h) => (
                              <div
                                key={h}
                                className="flex-1 border-r border-border/30 relative flex"
                              >
                                {/* Dotted half-hour indicator line */}
                                <div className="w-1/2 border-r border-dashed border-border/20 h-full" />
                              </div>
                            ))}
                          </div>

                          {/* Red "Current Time" Vertical Indicator Line */}
                          {currentTimePercent > 0 && currentTimePercent < 100 && (
                            <div
                              className="absolute top-0 bottom-0 z-10 w-0.5 bg-rose-500 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                              style={{ left: `${currentTimePercent}%` }}
                            >
                              <div className="w-2 h-2 rounded-full bg-rose-500 -ml-[3px] -mt-1 shadow" />
                            </div>
                          )}

                          {/* OS Scheduled Event Cards positioned precisely */}
                          {colabOrders.map((os) => {
                            const startDec = timeStringToDecimal(os.scheduledTimeStart || '08:00')
                            const endDec = timeStringToDecimal(os.scheduledTimeEnd || '09:00')

                            // Calculate horizontal position percentages
                            const leftPercent = Math.max(
                              0,
                              ((startDec - START_HOUR) / TOTAL_HOURS) * 100
                            )
                            const widthPercent = Math.max(
                              1.5,
                              ((endDec - startDec) / TOTAL_HOURS) * 100
                            )

                            const style = getCategoryStyle(os.category, os.subject)

                            return (
                              <motion.div
                                key={os.ixcId}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => {
                                  setSelectedOS(os)
                                  setSelectedOSId(os.ixcId)
                                }}
                                onMouseEnter={() => setHoveredOS(os)}
                                onMouseLeave={() => setHoveredOS(null)}
                                className={`absolute top-1.5 bottom-1.5 z-15 rounded-lg border ${style.bg} ${style.border} ${style.text} shadow-sm hover:shadow-md hover:z-20 cursor-pointer flex items-center px-1.5 transition-all overflow-hidden group/card`}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                              >
                                {/* Left Color Accent Bar */}
                                <div
                                  className={`w-1 h-full rounded-full ${style.bar} flex-shrink-0 mr-1.5`}
                                />

                                {/* Event Text (Category / Client Name formatted like IXC) */}
                                <div className="min-w-0 flex-1 overflow-hidden leading-tight">
                                  <p className="text-[10px] font-extrabold tracking-tight truncate uppercase">
                                    {os.subject || os.category}
                                  </p>
                                  {os.client && (
                                    <p className="text-[9px] font-semibold opacity-90 truncate">
                                      ::{os.client}
                                    </p>
                                  )}
                                </div>

                                {/* Status Icon Badge */}
                                <span className="ml-1 opacity-80 group-hover/card:opacity-100 flex-shrink-0 text-[10px]">
                                  {os.status === 'F' && '✓'}
                                  {os.status === 'EX' && '⚡'}
                                  {os.status === 'DS' && '🚗'}
                                </span>
                              </motion.div>
                            )
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DIA / COLABORADOR VIEW MODE (Columns per collaborator) */}
        {agendaViewMode === 'diaColaborador' && (
          <div className="flex-1 p-4 overflow-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {collaboratorsList.map((colab) => {
                const colabOrders = ordersByColab[colab.id] || []
                return (
                  <div
                    key={colab.id}
                    className="bg-card border border-border/70 rounded-2xl p-3 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase text-foreground">
                          {colab.name}
                        </h4>
                        <span className="text-[10px] text-muted-foreground">{colab.vehicle || 'Sem veículo'}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {colabOrders.length} O.S.
                      </span>
                    </div>

                    <div className="space-y-2 flex-1">
                      {colabOrders.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-4 text-center">
                          Nenhum agendamento para hoje
                        </p>
                      ) : (
                        colabOrders.map((os) => {
                          const style = getCategoryStyle(os.category, os.subject)
                          return (
                            <div
                              key={os.ixcId}
                              onClick={() => {
                                setSelectedOS(os)
                                setSelectedOSId(os.ixcId)
                              }}
                              className={`p-2.5 rounded-xl border ${style.bg} ${style.border} cursor-pointer hover:shadow-md transition-all flex flex-col gap-1`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-background/60">
                                  {os.scheduledTimeStart} - {os.scheduledTimeEnd}
                                </span>
                                <span className={`text-[10px] font-extrabold ${style.text}`}>
                                  #{os.number}
                                </span>
                              </div>
                              <p className={`text-xs font-bold truncate ${style.text}`}>
                                {os.subject}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {os.client} - {os.neighborhood}
                              </p>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 3 DIAS / SEMANA / MÊS VIEW MODES (Summary message & planning grid) */}
        {(agendaViewMode === '3dias' || agendaViewMode === 'semana' || agendaViewMode === 'mes') && (
          <div className="flex-1 p-6 overflow-auto flex flex-col items-center justify-center text-center">
            <div className="max-w-md bg-card border border-border/80 rounded-3xl p-6 shadow-xl space-y-4">
              <CalendarIcon className="w-12 h-12 text-primary mx-auto animate-bounce" />
              <h3 className="text-lg font-bold text-foreground capitalize">
                Visão de {agendaViewMode === '3dias' ? '3 Dias' : agendaViewMode === 'semana' ? 'Semana' : 'Mês'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Exibindo programação estendida para planejamento de equipes telecom e balanço de carga de trabalho.
              </p>
              <div className="grid grid-cols-2 gap-3 text-left pt-2">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Total O.S. Agendadas</span>
                  <p className="text-lg font-black text-primary">{serviceOrders.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Técnicos Ativos</span>
                  <p className="text-lg font-black text-emerald-500">{collaboratorsList.length - 1}</p>
                </div>
              </div>
              <button
                onClick={() => setAgendaViewMode('diaHora')}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-lg"
              >
                Voltar para Visão Dia/Hora
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HOVER TOOLTIP FLOATING POPOVER */}
      <AnimatePresence>
        {hoveredOS && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed bottom-6 right-6 z-50 bg-card border border-border rounded-2xl p-4 shadow-2xl w-80 pointer-events-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-primary">O.S. #{hoveredOS.number}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                {hoveredOS.scheduledTimeStart} - {hoveredOS.scheduledTimeEnd}
              </span>
            </div>
            <h4 className="text-sm font-bold text-foreground mb-1 leading-snug">{hoveredOS.subject}</h4>
            <p className="text-xs font-medium text-muted-foreground mb-2">{hoveredOS.client}</p>
            <div className="space-y-1 text-xs text-muted-foreground border-t border-border/50 pt-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">{hoveredOS.address}, {hoveredOS.neighborhood}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span className="truncate">{hoveredOS.collaboratorName || 'Sem Colaborador'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OS DETAILS & REASSIGNMENT MODAL */}
      <AnimatePresence>
        {selectedOS && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 relative overflow-hidden"
            >
              <button
                onClick={() => setSelectedOS(null)}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-muted-foreground">Detalhes do Agendamento</span>
                  <h3 className="text-lg font-black text-foreground">O.S. #{selectedOS.number}</h3>
                </div>
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assunto:</span>
                  <span className="font-bold text-foreground">{selectedOS.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-bold text-foreground">{selectedOS.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Endereço:</span>
                  <span className="font-medium text-foreground">{selectedOS.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horário Programado:</span>
                  <span className="font-bold text-emerald-600">
                    {selectedOS.scheduledTimeStart} às {selectedOS.scheduledTimeEnd}
                  </span>
                </div>
              </div>

              {/* Reassignment Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Reatribuir para outro Colaborador:
                </label>
                <select
                  value={selectedOS.teamId || ''}
                  onChange={(e) => {
                    const targetColab = Object.values(teams).find((t) => t.id === e.target.value)
                    if (targetColab) {
                      reassignOSSchedule(
                        selectedOS.ixcId,
                        targetColab.id,
                        targetColab.name,
                        selectedOS.scheduledTimeStart,
                        selectedOS.scheduledTimeEnd
                      )
                      setSelectedOS({
                        ...selectedOS,
                        teamId: targetColab.id,
                        collaboratorName: targetColab.name
                      })
                    }
                  }}
                  className="w-full p-3 bg-muted border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none"
                >
                  {Object.values(teams).map((colab) => (
                    <option key={colab.id} value={colab.id}>
                      {colab.name} ({colab.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setSelectedOS(null)
                    setActiveTab('monitor')
                  }}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:bg-primary/90 transition"
                >
                  Ver no Mapa Interativo
                </button>
                <button
                  onClick={() => setSelectedOS(null)}
                  className="py-2.5 px-4 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-muted/80"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW OS SCHEDULING DIALOG */}
      <AnimatePresence>
        {showNewOSModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.form
              onSubmit={handleCreateNewOS}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 relative"
            >
              <button
                type="button"
                onClick={() => setShowNewOSModal(false)}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-black text-foreground">Novo Agendamento de O.S.</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Nome do Cliente / Local</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Condomínio Grand Park"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full p-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Assunto da O.S.</label>
                  <input
                    type="text"
                    placeholder="Ex: INSTALAÇÃO VIA FIBRA"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full p-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Categoria</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as OSSubjectCategory)}
                      className="w-full p-2.5 bg-muted border border-border rounded-xl text-foreground"
                    >
                      <option value="Instalação">Instalação</option>
                      <option value="Sem conexão">Sem Conexão</option>
                      <option value="Lentidão">Lentidão</option>
                      <option value="Mudança de endereço">Mudança</option>
                      <option value="Configuração de roteador">Configuração</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Colaborador</label>
                    <select
                      value={newColabId}
                      onChange={(e) => setNewColabId(e.target.value)}
                      className="w-full p-2.5 bg-muted border border-border rounded-xl text-foreground"
                    >
                      <option value="">Selecione...</option>
                      {Object.values(teams).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Hora Início</label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full p-2.5 bg-muted border border-border rounded-xl text-foreground"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Hora Fim</label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full p-2.5 bg-muted border border-border rounded-xl text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Salvar Agendamento
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewOSModal(false)}
                  className="py-2.5 px-4 bg-muted text-foreground rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
