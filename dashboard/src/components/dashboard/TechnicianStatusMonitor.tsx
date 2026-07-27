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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXECUTION' | 'TRANSIT' | 'IDLE'>('ALL')
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

      // Find active O.S. (Execution or Transit or Assigned)
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

      // Active O.S. prioritized: EX (Executing) > DS (In Transit) > AG/A (Assigned)
      const executingOS = colabOrders.find((o) => o.status === 'EX')
      const transitOS = colabOrders.find((o) => o.status === 'DS')
      const assignedOS = colabOrders.find((o) => o.status === 'AG' || o.status === 'A' || o.status === 'AS' || o.status === 'EN')

      const activeOS = executingOS || transitOS || assignedOS || null

      let currentStatus: 'EXECUTION' | 'TRANSIT' | 'IDLE' = 'IDLE'
      if (executingOS || (teamMatch?.status === 'Executando atendimento')) {
        currentStatus = 'EXECUTION'
      } else if (transitOS || (teamMatch?.status === 'Em deslocamento')) {
        currentStatus = 'TRANSIT'
      } else {
        currentStatus = 'IDLE'
      }

      return {
        id: teamMatch?.id || `colab-${index + 1}`,
        name,
        vehicle: teamMatch?.vehicle || 'Veículo Frota',
        plate: teamMatch?.plate || 'HPX-1000',
        phone: teamMatch?.phone || '(98) 98812-1000',
        status: currentStatus,
        activeOS,
        totalTodayOS: colabOrders.length
      }
    })
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
    const execution = colabStatusList.filter((c) => c.status === 'EXECUTION').length
    const transit = colabStatusList.filter((c) => c.status === 'TRANSIT').length
    const idle = colabStatusList.filter((c) => c.status === 'IDLE').length

    return { total, execution, transit, idle }
  }, [colabStatusList])

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden rounded-2xl border border-slate-200 shadow-xl">
      {/* TOP HEADER: MONITOR TITLE & KPIs */}
      <header className="bg-white border-b border-slate-200 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-md">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900">
                Monitoramento de Status das O.S. por Técnico
              </h1>
              <p className="text-xs font-bold text-slate-500">
                Acompanhamento em tempo real das atividades em campo
              </p>
            </div>
          </div>
        </div>

        {/* KPI COUNTERS */}
        <div className="flex items-center gap-2">
          {/* Total Techs */}
          <div className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl text-center min-w-[80px]">
            <span className="block text-[10px] font-black uppercase text-slate-500">Total</span>
            <span className="text-base font-black text-slate-900">{kpis.total}</span>
          </div>

          {/* Executing OS (Green) */}
          <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-center min-w-[100px]">
            <span className="block text-[10px] font-black uppercase text-emerald-700">🟢 Em Atendimento</span>
            <span className="text-base font-black text-emerald-700">{kpis.execution}</span>
          </div>

          {/* In Transit (Amber) */}
          <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl text-center min-w-[100px]">
            <span className="block text-[10px] font-black uppercase text-amber-700">🟡 Deslocamento</span>
            <span className="text-base font-black text-amber-700">{kpis.transit}</span>
          </div>

          {/* Idle / Sem OS (Slate) */}
          <div className="bg-slate-200/80 border border-slate-300 px-3.5 py-1.5 rounded-xl text-center min-w-[90px]">
            <span className="block text-[10px] font-black uppercase text-slate-700">⚪ Sem O.S.</span>
            <span className="text-base font-black text-slate-800">{kpis.idle}</span>
          </div>
        </div>
      </header>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar técnico, cliente ou O.S...."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs font-bold w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Todos ({kpis.total})
          </button>

          <button
            onClick={() => setStatusFilter('EXECUTION')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'EXECUTION'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            🟢 Em Atendimento ({kpis.execution})
          </button>

          <button
            onClick={() => setStatusFilter('TRANSIT')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'TRANSIT'
                ? 'bg-amber-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
            }`}
          >
            🟡 Deslocamento ({kpis.transit})
          </button>

          <button
            onClick={() => setStatusFilter('IDLE')}
            className={`px-3 py-1 rounded-lg transition-all ${
              statusFilter === 'IDLE'
                ? 'bg-slate-700 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            ⚪ Sem O.S. ({kpis.idle})
          </button>
        </div>
      </div>

      {/* TECHNICIAN MONITORING CARDS GRID */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredList.map((colab) => {
            const isExec = colab.status === 'EXECUTION'
            const isTransit = colab.status === 'TRANSIT'
            const isIdle = colab.status === 'IDLE'

            return (
              <motion.div
                key={colab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white border-2 rounded-2xl p-4 shadow-md flex flex-col justify-between transition-all duration-200 ${
                  isExec
                    ? 'border-emerald-500 shadow-emerald-500/10'
                    : isTransit
                    ? 'border-amber-500 shadow-amber-500/10'
                    : 'border-slate-200'
                }`}
              >
                {/* Tech Header Info */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-sm flex-shrink-0 ${
                          isExec
                            ? 'bg-emerald-600'
                            : isTransit
                            ? 'bg-amber-600'
                            : 'bg-slate-400'
                        }`}
                      >
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase text-slate-900 truncate leading-tight">
                          {colab.name}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          {colab.vehicle}
                        </p>
                      </div>
                    </div>

                    {/* STATUS BADGE */}
                    <div className="flex-shrink-0">
                      {isExec && (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                          Em Atendimento
                        </span>
                      )}
                      {isTransit && (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <Navigation className="w-3 h-3 text-amber-600 animate-bounce" />
                          Deslocamento
                        </span>
                      )}
                      {isIdle && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          Sem O.S.
                        </span>
                      )}
                    </div>
                  </div>

                  <hr className="my-2 border-slate-100" />

                  {/* ACTIVE O.S. CONTENT AREA */}
                  {colab.activeOS ? (
                    <div
                      onClick={() => setSelectedOS(colab.activeOS)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isExec
                          ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/80'
                          : isTransit
                          ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/80'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {/* OS Number & Category */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                          O.S. #{colab.activeOS.number}
                        </span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 shadow-2xs">
                          {colab.activeOS.category}
                        </span>
                      </div>

                      {/* Client Name */}
                      <p className="text-xs font-black text-slate-900 truncate mb-1">
                        {colab.activeOS.client}
                      </p>

                      {/* Subject */}
                      <p className="text-[11px] font-bold text-slate-600 truncate mb-1">
                        {colab.activeOS.subject}
                      </p>

                      {/* Address */}
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold truncate">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {colab.activeOS.neighborhood || colab.activeOS.city || colab.activeOS.address}
                        </span>
                      </div>

                      {/* Scheduled Time */}
                      {colab.activeOS.scheduledTimeStart && (
                        <div className="mt-2 flex items-center justify-between text-[10px] font-extrabold text-slate-700 bg-white/80 px-2 py-1 rounded-lg border border-slate-200">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Horário:
                          </span>
                          <span>
                            {colab.activeOS.scheduledTimeStart} - {colab.activeOS.scheduledTimeEnd || '--:--'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center min-h-[95px]">
                      <CheckCircle2 className="w-6 h-6 text-slate-300 mb-1" />
                      <p className="text-xs font-black text-slate-500">Técnico Livre</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Nenhuma O.S. em andamento</p>
                    </div>
                  )}
                </div>

                {/* Footer Count */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                  <span>O.S. Hoje: <strong className="text-slate-900">{colab.totalTodayOS}</strong></span>
                  <span className="text-slate-400">{colab.phone}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* O.S. DETAILS MODAL */}
      <AnimatePresence>
        {selectedOS && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-slate-300 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Detalhes da O.S. #{selectedOS.number}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOS(null)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-black text-slate-700"
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[10px]">Cliente</span>
                  <span className="text-sm font-black text-slate-900">{selectedOS.client}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[10px]">Assunto</span>
                  <span className="font-bold text-slate-800">{selectedOS.subject}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[10px]">Endereço Completo</span>
                  <span className="font-bold text-slate-800">{selectedOS.address} - {selectedOS.neighborhood}, {selectedOS.city}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 font-extrabold uppercase block text-[10px]">Status</span>
                    <span className="font-black text-slate-900">{selectedOS.status === 'EX' ? '🟢 Execução' : selectedOS.status === 'DS' ? '🟡 Deslocamento' : '⚪ Agendado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-extrabold uppercase block text-[10px]">Técnico</span>
                    <span className="font-black text-slate-900">{selectedOS.collaboratorName || 'Não atribuído'}</span>
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
