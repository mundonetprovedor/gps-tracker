import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboardStore } from '@/store/dashboard'
import type { ServiceOrder } from '@/types'
import {
  Navigation,
  CheckCircle2,
  Search,
  User,
  MapPin,
  Clock,
  FileText,
  Car,
  Activity
} from 'lucide-react'

// 20 Exact Collaborators List
const EXACT_COLLABORATORS = [
  'ANTONIO PEDRO SILVA NETO',
  'CAIO ALMEIDA MENEZES',
  'ELIAS GONCALVES RIBEIRO',
  'GABRIEL DE SOUSA BARROS',
  'IVALDO MAIA MENDES',
  'JAILSON SANTOS SILVA',
  'JOAO VITOR MENDES MARTINS(Juninho)',
  'JONATAS SILVA PASSO',
  'JULIO CESAR LIMA DOS SANTOS',
  'LUCAS DE MOURA BRAGA',
  'MARCELINO SOUSA DOS SANTOS',
  'MATHEUS MORAES DOS SANTOS',
  'MOISES COELHO SOARES',
  'RAFAEL CUNHA DOS SANTOS',
  'RAMON BRENDON FREITAS COSTA',
  'ROMARIO COELHO SOUZA',
  'SILVAN DOS SANTOS MONTEIRO',
  'WALLACE EVERTON GOMES',
  'WANDERSON DA SILVA MARINHO',
  'WLADIMIR AIRES OLIVEIRA'
]

function normalizeStr(str?: string): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function TechnicianStatusMonitor() {
  const teams = useDashboardStore((s) => s.teams)
  const serviceOrders = useDashboardStore((s) => s.serviceOrders)
  const selectedAgendaDate = useDashboardStore((s) => s.selectedAgendaDate)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXECUTION' | 'TRANSIT' | 'COMPLETED' | 'IDLE'>('ALL')
  const [selectedOS, setSelectedOS] = useState<ServiceOrder | null>(null)

  // Map active O.S. to collaborators
  const colabStatusList = useMemo(() => {
    const storeTeams = Object.values(teams)
    const todayOrders = serviceOrders.filter((os) => {
      if (!os.scheduledDate) return true
      const dateOnly = String(os.scheduledDate).split('T')[0].split(' ')[0]
      return dateOnly === selectedAgendaDate
    })

    return EXACT_COLLABORATORS.map((name, index) => {
      // Find team record
      const teamMatch = storeTeams.find(
        (t) => normalizeStr(t.name) === normalizeStr(name)
      )

      // Find O.S. assigned to this collaborator today
      const colabOrders = todayOrders.filter((os) => {
        if (os.teamId && teamMatch && os.teamId === teamMatch.id) return true
        const osNorm = normalizeStr(os.collaboratorName || os.teamName)
        const cNorm = normalizeStr(name)
        if (!osNorm || !cNorm) return false
        if (osNorm === cNorm || osNorm.includes(cNorm) || cNorm.includes(osNorm)) return true
        const osParts = osNorm.split(' ')
        const cParts = cNorm.split(' ')
        if (osParts[0] === cParts[0] && osParts.length > 1 && cParts.length > 1 && osParts[osParts.length - 1] === cParts[cParts.length - 1]) return true
        return false
      })

      // Check O.S. statuses
      const executingOS = colabOrders.find((o) => o.status === 'EX')
      const transitOS = colabOrders.find((o) => o.status === 'DS')
      const completedOS = colabOrders.find((o) => o.status === 'F')
      const assignedOS = colabOrders.find((o) => o.status === 'AG' || o.status === 'A' || o.status === 'AS' || o.status === 'EN')

      const activeOS = executingOS || transitOS || completedOS || assignedOS || null

      let currentStatus: 'COMPLETED' | 'EXECUTION' | 'TRANSIT' | 'IDLE' = 'IDLE'

      if (executingOS || (teamMatch?.status === 'Executando atendimento')) {
        currentStatus = 'EXECUTION' // 🟦 AZUL
      } else if (transitOS || (teamMatch?.status === 'Em deslocamento')) {
        currentStatus = 'TRANSIT' // 🟨 AMARELO
      } else if (colabOrders.length > 0 && colabOrders.every((o) => o.status === 'F')) {
        currentStatus = 'COMPLETED' // 🟩 VERDE FORTE (Todas do dia concluídas)
      } else if (completedOS && !executingOS && !transitOS && !assignedOS) {
        currentStatus = 'COMPLETED' // 🟩 VERDE FORTE
      } else {
        currentStatus = 'IDLE' // ⚪ CINZA
      }

      return {
        id: teamMatch?.id || `colab-${index + 1}`,
        name,
        vehicle: teamMatch?.vehicle || 'Veículo Frota',
        plate: teamMatch?.plate || 'HPX-1000',
        phone: teamMatch?.phone || '(98) 98812-1000',
        status: currentStatus,
        activeOS,
        totalTodayOS: colabOrders.length,
        completedTodayOS: colabOrders.filter((o) => o.status === 'F').length
      }
    }).filter((item) => item.totalTodayOS > 0)
  }, [teams, serviceOrders, selectedAgendaDate])

  // Filtered List
  const filteredList = useMemo(() => {
    return colabStatusList.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchName = item.name.toLowerCase().includes(query)
        const matchOS = item.activeOS && (
          item.activeOS.client.toLowerCase().includes(query) ||
          item.activeOS.number.toLowerCase().includes(query) ||
          item.activeOS.subject.toLowerCase().includes(query)
        )
        return matchName || matchOS
      }
      return true
    })
  }, [colabStatusList, statusFilter, searchTerm])

  // KPI Counters
  const kpis = useMemo(() => {
    const total = colabStatusList.length
    const completed = colabStatusList.filter((c) => c.status === 'COMPLETED').length
    const execution = colabStatusList.filter((c) => c.status === 'EXECUTION').length
    const transit = colabStatusList.filter((c) => c.status === 'TRANSIT').length
    const idle = colabStatusList.filter((c) => c.status === 'IDLE').length
    const isAllCompleted = total > 0 && (completed + idle === total) && completed > 0

    return { total, completed, execution, transit, idle, isAllCompleted }
  }, [colabStatusList])

  // Group technicians by status
  const groupedTechs = useMemo(() => {
    const completedList = filteredList.filter((t) => t.status === 'COMPLETED').sort((a, b) => a.name.localeCompare(b.name))
    const execList = filteredList.filter((t) => t.status === 'EXECUTION').sort((a, b) => a.name.localeCompare(b.name))
    const transitList = filteredList.filter((t) => t.status === 'TRANSIT').sort((a, b) => a.name.localeCompare(b.name))
    const idleList = filteredList.filter((t) => t.status === 'IDLE').sort((a, b) => a.name.localeCompare(b.name))

    return [
      { id: 'EXECUTION', title: '🟦 TÉCNICOS EM EXECUÇÃO', count: execList.length, items: execList },
      { id: 'TRANSIT', title: '🟨 TÉCNICOS EM DESLOCAMENTO', count: transitList.length, items: transitList },
      { id: 'COMPLETED', title: '🟩 O.S. CONCLUÍDAS COM SUCESSO', count: completedList.length, items: completedList },
      { id: 'IDLE', title: '⚪ TÉCNICOS LIVRES', count: idleList.length, items: idleList }
    ].filter((group) => statusFilter === 'ALL' || statusFilter === group.id)
  }, [filteredList, statusFilter])

  const renderCard = (colab: typeof colabStatusList[0]) => {
    const isCompleted = colab.status === 'COMPLETED'
    const isExec = colab.status === 'EXECUTION'
    const isTransit = colab.status === 'TRANSIT'
    const isIdle = colab.status === 'IDLE'

    return (
      <motion.div
        key={colab.id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`border-3 rounded-2xl p-3 flex flex-col justify-between overflow-hidden shadow-2xl transition-all ${
          isCompleted
            ? 'bg-emerald-700 border-emerald-400 text-white shadow-emerald-600/50 font-black'
            : isExec
            ? 'bg-blue-950/95 border-blue-500 shadow-blue-500/40'
            : isTransit
            ? 'bg-amber-950/95 border-amber-500 shadow-amber-500/40'
            : 'bg-slate-900 border-slate-700'
        }`}
      >
        {/* Tech Header Info */}
        <div>
          {/* CARD TOP BANNER WITH STATUS */}
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs text-white flex-shrink-0 shadow-md ${
                  isCompleted
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-400'
                    : isExec
                    ? 'bg-blue-500 text-slate-950'
                    : isTransit
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-700 text-white'
                }`}
              >
                <User className="w-4 h-4 font-black" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm md:text-base font-black uppercase text-amber-300 leading-snug tracking-wide break-words drop-shadow-sm">
                  {colab.name}
                </h3>
                <p className="text-[10px] md:text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate leading-tight mt-0.5">
                  <Car className="w-3 h-3 flex-shrink-0" />
                  {colab.vehicle}
                </p>
              </div>
            </div>

            {/* ULTRA HIGH CONTRAST STATUS BADGES (TV TUNED) */}
            <div className="flex-shrink-0">
              {isCompleted && (
                <span className="px-2.5 py-1 bg-emerald-400 text-emerald-950 font-black rounded-lg text-[10px] md:text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-950 font-black" />
                  CONCLUÍDA
                </span>
              )}
              {isExec && (
                <span className="px-2.5 py-1 bg-blue-500 text-white font-black rounded-lg text-[10px] md:text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  EM EXECUÇÃO
                </span>
              )}
              {isTransit && (
                <span className="px-2.5 py-1 bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] md:text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Navigation className="w-3 h-3 text-slate-950" />
                  DESLOCAMENTO
                </span>
              )}
              {isIdle && (
                <span className="px-2 py-1 bg-slate-700 text-slate-300 font-extrabold rounded-lg text-[10px] uppercase tracking-wider">
                  SEM O.S.
                </span>
              )}
            </div>
          </div>

          <hr className={`my-1.5 ${isCompleted ? 'border-emerald-500' : isExec ? 'border-blue-800' : isTransit ? 'border-amber-800' : 'border-slate-800'}`} />

          {/* ACTIVE O.S. CONTENT AREA (TV TUNED) */}
          {colab.activeOS ? (
            <div
              onClick={() => setSelectedOS(colab.activeOS)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isCompleted
                  ? 'bg-emerald-800 border-emerald-300 text-white hover:bg-emerald-900'
                  : isExec
                  ? 'bg-blue-900/90 border-blue-400 text-blue-50 hover:bg-blue-800'
                  : isTransit
                  ? 'bg-amber-900/90 border-amber-400 text-amber-50 hover:bg-amber-800'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              {/* OS Number & Category */}
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[10px] md:text-[11px] font-black uppercase text-white truncate">
                  O.S. #{colab.activeOS.number}
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/40 border border-white/20 text-white truncate">
                  {colab.activeOS.category}
                </span>
              </div>

              {/* Client Name & Login Status */}
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <p className="text-xs md:text-sm font-black text-white truncate leading-snug">
                  {colab.activeOS.client}
                </p>

                {/* LOGIN STATUS BADGE (ONLINE / OFFLINE) */}
                {(() => {
                  const isOnline = colab.activeOS.loginStatus === 'online'

                  return isOnline ? (
                    <span className="px-1.5 py-0.5 bg-emerald-400 text-emerald-950 font-black rounded text-[9px] uppercase tracking-tight flex items-center gap-1 shadow flex-shrink-0 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-950" />
                      🟢 ONLINE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-red-600 text-white font-black rounded text-[9px] uppercase tracking-tight flex items-center gap-1 shadow flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      🔴 OFFLINE
                    </span>
                  )
                })()}
              </div>

              {/* Subject */}
              <p className="text-[10px] md:text-[11px] font-extrabold text-slate-100 truncate">
                {colab.activeOS.subject}
              </p>

              {/* Address */}
              <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-slate-200 font-bold truncate mt-0.5">
                <MapPin className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span className="truncate">
                  {colab.activeOS.neighborhood || colab.activeOS.city || colab.activeOS.address}
                </span>
              </div>

              {/* Scheduled Time */}
              {colab.activeOS.scheduledTimeStart && (
                <div className="mt-1.5 flex items-center justify-between text-[9px] md:text-[10px] font-black text-white bg-black/60 px-2 py-0.5 rounded-lg border border-white/10">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-300" />
                    Horário:
                  </span>
                  <span>
                    {colab.activeOS.scheduledTimeStart} - {colab.activeOS.scheduledTimeEnd || '--:--'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center flex flex-col items-center justify-center min-h-[70px]">
              <CheckCircle2 className="w-5 h-5 text-slate-500 mb-0.5" />
              <p className="text-xs font-black text-slate-300 leading-tight">TÉCNICO LIVRE</p>
              <p className="text-[9px] text-slate-400 font-bold">Nenhuma O.S. ativa</p>
            </div>
          )}
        </div>

        {/* Footer Count Prominent Highlight (43" TV TUNED) */}
        <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center justify-between gap-1">
          <div className={`px-2.5 py-1 rounded-xl font-black text-[10px] md:text-[11px] flex items-center gap-2 shadow-md ${
            isCompleted
              ? 'bg-emerald-400 text-emerald-950'
              : colab.completedTodayOS > 0
              ? 'bg-emerald-950 border border-emerald-400 text-emerald-200'
              : 'bg-black/80 border border-slate-700 text-slate-200'
          }`}>
            <span className="uppercase text-[9px] md:text-[10px] font-black tracking-tight">O.S. Concluídas:</span>
            <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-lg bg-slate-950 text-emerald-400 border border-emerald-500/40 shadow-inner">
              {colab.completedTodayOS} / {colab.totalTodayOS}
            </span>
          </div>
          <span className="text-[9px] md:text-[10px] font-bold text-slate-400 truncate max-w-[80px] text-right">{colab.phone}</span>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-900 overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      {/* TOP HEADER: MONITOR TITLE & KPIs (HIGH CONTRAST DARK 43" TV THEME) */}
      <header className="bg-slate-950 border-b border-slate-800 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl shadow-md shadow-emerald-500/20">
            <Activity className="w-5 h-5 font-black" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-tight text-white leading-none">
              MONITORAMENTO DE STATUS DAS O.S. POR TÉCNICO
            </h1>
            <p className="text-xs font-black text-slate-400 mt-0.5 uppercase tracking-widest">
              Painel em Tempo Real de Acompanhamento das O.S. (TV 43")
            </p>
          </div>
        </div>

        {/* KPI COUNTERS (TV TUNED) */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-800 border-2 border-slate-700 px-3.5 py-1.5 rounded-xl text-center min-w-[75px]">
            <span className="block text-[10px] font-black uppercase text-slate-400">Total</span>
            <span className="text-sm md:text-base font-black text-white">{kpis.total}</span>
          </div>

          {/* COMPLETED (VERDE FORTE) */}
          <div className="bg-emerald-600 text-white border-2 border-emerald-400 px-3.5 py-1.5 rounded-xl text-center min-w-[105px] shadow-lg shadow-emerald-600/30">
            <span className="block text-[10px] font-black uppercase text-emerald-100">🟩 CONCLUÍDAS</span>
            <span className="text-sm md:text-base font-black text-white">{kpis.completed}</span>
          </div>

          {/* EXECUTION (AZUL) */}
          <div className="bg-blue-600 text-white border-2 border-blue-400 px-3.5 py-1.5 rounded-xl text-center min-w-[105px] shadow-lg shadow-blue-600/30">
            <span className="block text-[10px] font-black uppercase text-blue-100">🟦 EM EXECUÇÃO</span>
            <span className="text-sm md:text-base font-black text-white">{kpis.execution}</span>
          </div>

          {/* TRANSIT (AMARELO) */}
          <div className="bg-amber-500 text-slate-950 border-2 border-amber-300 px-3.5 py-1.5 rounded-xl text-center min-w-[105px] shadow-lg shadow-amber-500/30">
            <span className="block text-[10px] font-black uppercase text-amber-950">🟨 DESLOCAMENTO</span>
            <span className="text-sm md:text-base font-black text-slate-950">{kpis.transit}</span>
          </div>

          {/* IDLE (CINZA) */}
          <div className="bg-slate-700 text-white border-2 border-slate-500 px-3 py-1.5 rounded-xl text-center min-w-[85px] shadow-md">
            <span className="block text-[10px] font-black uppercase text-slate-300">⚪ SEM O.S.</span>
            <span className="text-sm md:text-base font-black text-white">{kpis.idle}</span>
          </div>
        </div>
      </header>

      {/* SUCCESS ALL COMPLETED BANNER */}
      {kpis.isAllCompleted && (
        <div className="bg-emerald-600 border-b-2 border-emerald-400 px-4 py-2 text-center text-white font-black text-sm uppercase tracking-widest animate-pulse shadow-lg flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-white" />
          🎉 TODAS AS O.S. DO DIA FORAM CONCLUÍDAS COM SUCESSO! 🎉
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-950 px-4 py-1.5 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 flex-shrink-0">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar técnico ou O.S...."
            className="w-full pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-0.5 rounded transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-700 text-white font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todos ({kpis.total})
          </button>

          <button
            onClick={() => setStatusFilter('EXECUTION')}
            className={`px-3 py-0.5 rounded transition-all ${
              statusFilter === 'EXECUTION'
                ? 'bg-blue-600 text-white font-black'
                : 'text-blue-400 hover:bg-blue-950'
            }`}
          >
            🟦 Em Execução ({kpis.execution})
          </button>

          <button
            onClick={() => setStatusFilter('TRANSIT')}
            className={`px-3 py-0.5 rounded transition-all ${
              statusFilter === 'TRANSIT'
                ? 'bg-amber-500 text-white font-black'
                : 'text-amber-400 hover:bg-amber-950'
            }`}
          >
            🟨 Deslocamento ({kpis.transit})
          </button>

          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-0.5 rounded transition-all ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white font-black'
                : 'text-emerald-400 hover:bg-emerald-950'
            }`}
          >
            🟩 Concluídas ({kpis.completed})
          </button>

          <button
            onClick={() => setStatusFilter('IDLE')}
            className={`px-3 py-0.5 rounded transition-all ${
              statusFilter === 'IDLE'
                ? 'bg-slate-600 text-white font-black'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            ⚪ Sem O.S. ({kpis.idle})
          </button>
        </div>
      </div>

      {/* TECHNICIAN MONITORING GROUPED SECTIONS */}
      <div className="flex-1 overflow-y-auto p-2.5 bg-slate-950 space-y-4 custom-scrollbar">
        {groupedTechs.map((group) => {
          if (group.items.length === 0) return null

          const isCompletedGroup = group.id === 'COMPLETED'
          const isExecGroup = group.id === 'EXECUTION'
          const isTransitGroup = group.id === 'TRANSIT'

          return (
            <div key={group.id} className="space-y-2">
              {/* GROUP SECTION HEADER BANNER */}
              <div className={`px-3 py-1 rounded-lg border flex items-center justify-between text-xs font-black uppercase tracking-wider ${
                isCompletedGroup
                  ? 'bg-emerald-800 border-emerald-400 text-white shadow-md shadow-emerald-950'
                  : isExecGroup
                  ? 'bg-blue-950/90 border-blue-500 text-blue-400 shadow-md shadow-blue-950'
                  : isTransitGroup
                  ? 'bg-amber-950/90 border-amber-500 text-amber-400 shadow-md shadow-amber-950'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}>
                <span className="flex items-center gap-2">
                  {group.title}
                </span>
                <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] font-black border border-white/10">
                  {group.count} {group.count === 1 ? 'Técnico' : 'Técnicos'}
                </span>
              </div>

              {/* GROUP CARDS GRID */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {group.items.map(renderCard)}
              </div>
            </div>
          )
        })}
      </div>

      {/* O.S. DETAILS MODAL */}
      <AnimatePresence>
        {selectedOS && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-slate-300 rounded-2xl max-w-md w-full p-5 shadow-2xl overflow-hidden text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Detalhes da O.S. #{selectedOS.number}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOS(null)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-black text-slate-700"
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[9px]">Cliente</span>
                  <span className="text-xs font-black text-slate-900">{selectedOS.client}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[9px]">Assunto</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedOS.subject}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[9px]">Endereço Completo</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedOS.address} - {selectedOS.neighborhood}, {selectedOS.city}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-extrabold uppercase block text-[9px]">Status</span>
                    <span className="font-black text-slate-900">{selectedOS.status === 'EX' ? '🟢 Execução' : selectedOS.status === 'DS' ? '🟡 Deslocamento' : '⚪ Agendado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-extrabold uppercase block text-[9px]">Técnico</span>
                    <span className="font-black text-slate-900 truncate block">{selectedOS.collaboratorName || 'Não atribuído'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
