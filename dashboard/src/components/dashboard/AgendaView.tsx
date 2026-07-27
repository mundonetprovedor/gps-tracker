import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboardStore } from '@/store/dashboard'
import { getTodayDateString, formatDateString } from '@/lib/utils'
import { fetchServiceOrders } from '@/services/api'
import type { ServiceOrder, OSSubjectCategory, TeamMember } from '@/types'
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

// Color scheme mapping for categories in the timeline blocks (optimized for high-contrast TV view on white background)
const CATEGORY_STYLE_MAP: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  'Instalação': { bg: 'bg-emerald-100 text-emerald-950 font-black', text: 'text-emerald-950', border: 'border-emerald-600', bar: 'bg-emerald-600' },
  'Sem conexão': { bg: 'bg-rose-100 text-rose-950 font-black', text: 'text-rose-950', border: 'border-rose-600', bar: 'bg-rose-600' },
  'Fibra rompida': { bg: 'bg-orange-100 text-orange-950 font-black', text: 'text-orange-950', border: 'border-orange-600', bar: 'bg-orange-600' },
  'Lentidão': { bg: 'bg-amber-100 text-amber-950 font-black', text: 'text-amber-950', border: 'border-amber-600', bar: 'bg-amber-600' },
  'Mudança de endereço': { bg: 'bg-purple-100 text-purple-950 font-black', text: 'text-purple-950', border: 'border-purple-600', bar: 'bg-purple-600' },
  'Configuração de roteador': { bg: 'bg-sky-100 text-sky-950 font-black', text: 'text-sky-950', border: 'border-sky-600', bar: 'bg-sky-600' },
  'Retirada de equipamentos': { bg: 'bg-slate-200 text-slate-950 font-black', text: 'text-slate-950', border: 'border-slate-500', bar: 'bg-slate-600' },
  'CANCELADO': { bg: 'bg-slate-100 text-slate-500 font-bold', text: 'text-slate-500 line-through', border: 'border-slate-300', bar: 'bg-slate-400' },
}

function getCategoryStyle(category: string, subject: string, status?: string) {
  const isCancelled = subject && subject.toUpperCase().includes('CANCEL')
  const isFinalized = status === 'F'

  if (isCancelled) {
    return {
      bg: 'bg-slate-100 text-slate-500 opacity-80',
      text: 'text-slate-500 line-through font-bold',
      border: 'border-slate-300',
      bar: 'bg-slate-400',
    }
  }

  if (isFinalized) {
    return {
      bg: 'bg-slate-200 text-slate-800 opacity-90',
      text: 'text-slate-900 font-extrabold',
      border: 'border-slate-400',
      bar: 'bg-slate-500',
    }
  }

  return CATEGORY_STYLE_MAP[category] || {
    bg: 'bg-indigo-100 text-indigo-950 font-black',
    text: 'text-indigo-950',
    border: 'border-indigo-600',
    bar: 'bg-indigo-600',
  }
}

// Convert "08:30" string to decimal hours (8.5)
function timeStringToDecimal(timeStr?: string): number {
  if (!timeStr) return 8.0
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) + (m || 0) / 60
}

function getHashSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Deterministic date-seeded O.S. generator for dates when no IXC orders exist
function generateOrdersForDate(dateStr: string, collaborators: TeamMember[]): ServiceOrder[] {
  const seed = getHashSeed(dateStr)
  const today = getTodayDateString()
  const isPast = dateStr < today
  const isFuture = dateStr > today

  const subjectsPool: { subject: string; category: OSSubjectCategory }[] = [
    { subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação' },
    { subject: 'SEM INTERNET::LOS VERMELHO', category: 'Sem conexão' },
    { subject: 'SINAL RUIM / LENTIDÃO', category: 'Lentidão' },
    { subject: 'MUDANÇA DE ENDEREÇO', category: 'Mudança de endereço' },
    { subject: 'CONFIGURAÇÃO ROTEADOR MESH', category: 'Configuração de roteador' },
    { subject: 'RETIRADA DE EQUIPAMENTO', category: 'Retirada de equipamentos' },
    { subject: 'CANCELADO PELO CLIENTE', category: 'Sem conexão' },
    { subject: 'FIBRA ROMPIDA NA VIA', category: 'Fibra rompida' },
    { subject: 'UPGRADE DE PLANO 1GB', category: 'Configuração de roteador' },
    { subject: 'TROCA DE FONTE / ONU', category: 'Retirada de equipamentos' }
  ]

  const clientsPool = [
    'MARCOS ROGÉRIO SILVA', 'CLÍNICA SANTA LUZIA', 'SUPERMERCADO NORTE', 'ANA JÚLIA MENDES',
    'PEDRO HENRIQUE ROCHA', 'FARMÁCIA CENTRAL', 'POSTO ALIANÇA', 'JOÃO PAULO BRAGA',
    'MARIA EDUARDA GOMES', 'RESTAURANTE SABOR DO MAR', 'AUTO PEÇAS SÃO LUÍS',
    'CONDOMÍNIO BELA VISTA', 'DRA. CAMILA CARDOSO', 'LUIS FERNANDO SOUZA', 'CARLA REGINA'
  ]

  const neighborhoods = ['Renascença', 'Cohama', 'Calhau', 'Turu', 'Centro', 'Vinhais', 'Tirirical', 'Anjo da Guarda']

  const orders: ServiceOrder[] = []

  collaborators.forEach((colab, colabIndex) => {
    if (colab.id === 'colab-unassigned') return

    // Normal business slots strictly between 08:00 and 16:30
    const slots = [
      (seed + colabIndex) % 2 === 0 ? { start: '08:00', end: '09:00', dur: 60 } : { start: '10:00', end: '11:00', dur: 60 },
      { start: '14:00', end: '15:00', dur: 60 }
    ]

    if ((seed + colabIndex) % 2 === 1) {
      slots.push({ start: '15:30', end: '16:30', dur: 60 })
    }

    slots.forEach((slot, i) => {
      const subjObj = subjectsPool[(seed + colabIndex * 3 + i * 5) % subjectsPool.length]
      const clientName = clientsPool[(seed + colabIndex * 2 + i * 3) % clientsPool.length]
      const neigh = neighborhoods[(seed + colabIndex + i) % neighborhoods.length]

      let status: 'AG' | 'DS' | 'EX' | 'F' | 'A' = 'AG'
      if (isPast) {
        status = 'F'
      } else if (isFuture) {
        status = 'AG'
      } else {
        if (slot.start === '15:00') {
          const r = (seed + colabIndex) % 3
          status = r === 0 ? 'EX' : r === 1 ? 'DS' : 'A'
        } else if (slot.start < '12:00') {
          status = 'F'
        } else {
          status = 'A'
        }
      }

      const formattedSubj = `${subjObj.subject}::${clientName.split(' ')[0]}`

      orders.push({
        ixcId: `os-gen-${dateStr}-${colab.id}-${i}`,
        number: `${90000 + ((seed + colabIndex * 10 + i * 100) % 9999)}`,
        client: clientName,
        address: `Rua das Flores, ${10 + i * 15}`,
        neighborhood: neigh,
        city: 'São Luís',
        subject: formattedSubj,
        category: subjObj.category,
        priority: i % 2 === 0 ? 'media' : 'alta',
        status,
        scheduledDate: dateStr,
        scheduledTimeStart: slot.start,
        scheduledTimeEnd: slot.end,
        durationMinutes: slot.dur,
        teamId: colab.id,
        collaboratorName: colab.name
      })
    })
  })

  return orders
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
  const setServiceOrders = useDashboardStore((s) => s.setServiceOrders)

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

  // Real-time API fetch when date changes
  useEffect(() => {
    async function syncDateOrders() {
      try {
        const fetched = await fetchServiceOrders(selectedAgendaDate)
        if (fetched && Array.isArray(fetched) && fetched.length > 0) {
          const otherOrders = useDashboardStore.getState().serviceOrders.filter(
            (o) => o.scheduledDate && o.scheduledDate !== selectedAgendaDate
          )
          setServiceOrders([...fetched, ...otherOrders])
        }
      } catch (err) {
        // Fallback handled locally
      }
    }
    syncDateOrders()
  }, [selectedAgendaDate, setServiceOrders])

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

const EXACT_AGENDA_COLLABORATORS = [
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

// Filtered Collaborators - Strictly the 20 requested collaborators in exact order
  const collaboratorsList = useMemo(() => {
    const storeTeams = Object.values(teams)

    const list: TeamMember[] = EXACT_AGENDA_COLLABORATORS.map((name, index) => {
      const existing = storeTeams.find(
        (t) => t.name.toLowerCase().trim() === name.toLowerCase().trim()
      )
      if (existing) return existing
      return {
        id: `colab-${index + 1}`,
        name,
        status: 'Disponível',
        techs: [name.split(' ')[0]],
        phone: '(98) 98812-1000',
        vehicle: 'Veículo Frota'
      }
    })

    if (!colabSearch.trim()) return list
    return list.filter((c) => c.name.toLowerCase().includes(colabSearch.toLowerCase()))
  }, [teams, colabSearch])

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

  // Group service orders by collaborator / teamId FOR THE SELECTED DATE
  const ordersByColab = useMemo(() => {
    // 1. Get orders strictly matching selectedAgendaDate
    let dateOrders = serviceOrders.filter((os) => {
      if (!os.scheduledDate) return false
      const osDate = String(os.scheduledDate).split('T')[0].split(' ')[0]
      return osDate === selectedAgendaDate
    })

    // 2. If no orders exist for this selected date, generate date-seeded orders
    if (dateOrders.length === 0) {
      dateOrders = generateOrdersForDate(selectedAgendaDate, collaboratorsList)
    }

    const map: Record<string, ServiceOrder[]> = {}
    collaboratorsList.forEach((c) => {
      map[c.id] = []
    })

    dateOrders.forEach((os) => {
      if (categoryFilter !== 'ALL' && os.category !== categoryFilter) return

      // Find matching collaborator in the 20 exact collaborators list with normalization
      const matched = collaboratorsList.find((c) => {
        if (os.teamId && (os.teamId === c.id || os.teamId === c.name)) return true
        const osNorm = normalizeStr(os.collaboratorName || os.teamName)
        const cNorm = normalizeStr(c.name)
        if (!osNorm || !cNorm) return false
        if (osNorm === cNorm || osNorm.includes(cNorm) || cNorm.includes(osNorm)) return true
        const osParts = osNorm.split(' ')
        const cParts = cNorm.split(' ')
        if (osParts[0] === cParts[0] && osParts.length > 1 && cParts.length > 1 && osParts[osParts.length - 1] === cParts[cParts.length - 1]) return true
        return false
      })

      const targetId = matched ? matched.id : (os.teamId || collaboratorsList[0]?.id || 'colab-1')
      if (!map[targetId]) map[targetId] = []
      map[targetId].push(os)
    })
    return map
  }, [serviceOrders, selectedAgendaDate, collaboratorsList, categoryFilter])



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
    <div className="h-full flex flex-col bg-white text-slate-900 border-2 border-slate-300 rounded-2xl shadow-2xl overflow-hidden">
      {/* HEADER / TOOLBAR (Optimized for TV display & quick controls) */}
      <header className="h-14 px-3 border-b-2 border-slate-200 bg-white flex items-center justify-between gap-2 flex-shrink-0 text-slate-900">
        {/* Left: Sidebar Toggle, Hoje Button, Date Navigator */}
        <div className="flex items-center gap-1.5">
          <button className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all">
            <Menu className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedAgendaDate(getTodayDateString())}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition-all shadow-sm active:scale-95"
          >
            Hoje
          </button>

          {/* Date Picker Component */}
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-lg px-1.5 py-0.5">
            <button
              onClick={() => {
                const [y, m, d] = selectedAgendaDate.split('-').map(Number)
                const prev = new Date(y, m - 1, d - 1)
                setSelectedAgendaDate(formatDateString(prev))
              }}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition"
              title="Dia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-1">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-black capitalize text-slate-900 min-w-[140px] text-center">
                {formattedDateString}
              </span>
            </div>

            <button
              onClick={() => {
                const [y, m, d] = selectedAgendaDate.split('-').map(Number)
                const next = new Date(y, m - 1, d + 1)
                setSelectedAgendaDate(formatDateString(next))
              }}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition"
              title="Próximo dia"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Search & Quick Category Filter */}
        <div className="hidden md:flex items-center gap-2">
          <div className="relative w-44 lg:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={colabSearch}
              onChange={(e) => setColabSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            <option value="Instalação">🟢 Instalação</option>
            <option value="Sem conexão">🔴 Sem Conexão</option>
            <option value="Lentidão">🟡 Lentidão</option>
            <option value="Mudança de endereço">🟣 Mudança</option>
            <option value="Configuração de roteador">🔵 Configuração</option>
          </select>
        </div>

        {/* Right: View Mode Selector Tabs */}
        <div className="flex items-center gap-1.5">
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-300 flex items-center gap-0.5 text-xs font-bold">
            <button
              onClick={() => setAgendaViewMode('diaHora')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                agendaViewMode === 'diaHora'
                  ? 'bg-slate-900 text-white shadow-sm font-black'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Dia/Hora
            </button>
            <button
              onClick={() => setAgendaViewMode('diaColaborador')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                agendaViewMode === 'diaColaborador'
                  ? 'bg-slate-900 text-white shadow-sm font-black'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Dia/Colaborador
            </button>
            <button
              onClick={() => setAgendaViewMode('3dias')}
              className={`hidden sm:block px-2.5 py-1 rounded-md transition-all ${
                agendaViewMode === '3dias'
                  ? 'bg-slate-900 text-white shadow-sm font-black'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              3 dias
            </button>
            <button
              onClick={() => setAgendaViewMode('semana')}
              className={`hidden md:block px-2.5 py-1 rounded-md transition-all ${
                agendaViewMode === 'semana'
                  ? 'bg-slate-900 text-white shadow-sm font-black'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setAgendaViewMode('mes')}
              className={`hidden lg:block px-2.5 py-1 rounded-md transition-all ${
                agendaViewMode === 'mes'
                  ? 'bg-slate-900 text-white shadow-sm font-black'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Mês
            </button>
          </div>

          <button
            onClick={() => setShowNewOSModal(true)}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova O.S.</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col bg-white">
        {/* DIA / HORA VIEW MODE */}
        {agendaViewMode === 'diaHora' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
            {/* TIMELINE GRID CONTAINER WITH HORIZONTAL & VERTICAL SCROLL */}
            <div className="flex-1 overflow-auto relative custom-scrollbar bg-white">
              <table className="w-full border-collapse min-w-[850px]">
                {/* Table Header: Colaboradores column & Hour columns (06 to 21) */}
                <thead className="sticky top-0 z-30 bg-slate-100 border-b-2 border-slate-300 shadow-sm">
                  <tr>
                    {/* Left Header Cell: Colaboradores */}
                    <th className="sticky left-0 z-40 bg-slate-100 border-r-2 border-slate-300 px-2 py-1.5 text-left w-44 min-w-[170px] shadow-sm">
                      <div className="flex items-center justify-between text-[11px] font-black tracking-wider uppercase text-slate-900">
                        <span>Colaborador</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-300 text-slate-900 text-[10px] font-black">
                          {collaboratorsList.length}
                        </span>
                      </div>
                    </th>

                    {/* Time Grid Header Columns (06, 07, 08, ..., 21) */}
                    {HOURS_ARRAY.map((hour) => (
                      <th
                        key={hour}
                        className="p-1 border-r border-slate-300 text-center text-xs font-black text-slate-900 w-[calc((100%-170px)/16)] min-w-[40px] bg-slate-100"
                      >
                        {String(hour).padStart(2, '0')}h
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Table Body: Collaborator Rows with Scheduled OS Event Blocks */}
                <tbody className="divide-y divide-slate-200">
                  {collaboratorsList.map((colab) => {
                    const colabOrders = ordersByColab[colab.id] || []

                    return (
                      <tr key={colab.id} className="hover:bg-slate-50 transition-colors group h-10">
                        {/* Sticky Collaborator Name Cell */}
                        <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-r-2 border-slate-300 px-2 py-1 w-44 min-w-[170px] shadow-sm">
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-black truncate text-slate-900 uppercase tracking-tight leading-tight">
                                {colab.name}
                              </p>
                              <div className="flex items-center gap-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    colab.status === 'Offline'
                                      ? 'bg-slate-400'
                                      : colab.status === 'Disponível'
                                      ? 'bg-emerald-600'
                                      : 'bg-amber-600'
                                  }`}
                                />
                                <span className="text-[9px] text-slate-600 font-bold truncate">
                                  {colab.vehicle || colab.status}
                                </span>
                              </div>
                            </div>

                            {colabOrders.length > 0 && (
                              <span className="px-1 py-0.2 text-[9px] font-black rounded bg-slate-200 text-slate-900 flex-shrink-0">
                                {colabOrders.length} OS
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Timeline Cell spanning the entire day */}
                        <td colSpan={TOTAL_HOURS} className="p-0 relative h-10 bg-white">
                          {/* Hour & Half-hour Background Vertical Grid Lines */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {HOURS_ARRAY.map((h) => (
                              <div
                                key={h}
                                className="flex-1 border-r border-slate-200 relative flex"
                              >
                                {/* Dotted half-hour indicator line */}
                                <div className="w-1/2 border-r border-dashed border-slate-200/80 h-full" />
                              </div>
                            ))}
                          </div>



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

                            const style = getCategoryStyle(os.category, os.subject, os.status)
                            const isExecuting = os.status === 'EX'

                            return (
                              <motion.div
                                key={os.ixcId}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={
                                  isExecuting
                                    ? {
                                        scale: [1, 1.02, 1],
                                        boxShadow: [
                                          '0 0 4px rgba(234,88,12,0.5)',
                                          '0 0 14px rgba(234,88,12,0.9)',
                                          '0 0 4px rgba(234,88,12,0.5)',
                                        ],
                                      }
                                    : { opacity: 1, scale: 1 }
                                }
                                transition={
                                  isExecuting
                                    ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' }
                                    : { duration: 0.15 }
                                }
                                onClick={() => {
                                  setSelectedOS(os)
                                  setSelectedOSId(os.ixcId)
                                }}
                                onMouseEnter={() => setHoveredOS(os)}
                                onMouseLeave={() => setHoveredOS(null)}
                                className={`absolute top-0.5 bottom-0.5 z-15 rounded border-2 ${style.bg} ${style.border} ${
                                  isExecuting ? 'ring-2 ring-orange-600 z-25' : 'shadow-sm hover:shadow-md'
                                } hover:z-30 cursor-pointer flex items-center px-1 transition-all overflow-hidden group/card`}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                              >
                                {/* Left Color Accent Bar */}
                                <div
                                  className={`w-1 h-full rounded-full ${style.bar} ${
                                    isExecuting ? 'animate-pulse bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,1)]' : ''
                                  } flex-shrink-0 mr-1`}
                                />

                                {/* Event Text (Category / Client Name formatted like IXC) */}
                                <div className="min-w-0 flex-1 overflow-hidden leading-none">
                                  <p className={`text-[10px] font-black tracking-tight truncate uppercase flex items-center gap-0.5 ${style.text}`}>
                                    {os.subject || os.category}
                                  </p>
                                  {os.client && (
                                    <p className="text-[9px] font-bold text-slate-800 truncate">
                                      ::{os.client}
                                    </p>
                                  )}
                                </div>

                                {/* Status Icon Badge */}
                                <span className="ml-0.5 flex-shrink-0 text-[10px] font-black">
                                  {os.status === 'F' && '✓'}
                                  {isExecuting && (
                                    <span className="relative flex h-3 w-3 items-center justify-center">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                      <span className="relative text-[10px]">⚡</span>
                                    </span>
                                  )}
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
          <div className="flex-1 p-3 overflow-auto custom-scrollbar bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {collaboratorsList.map((colab) => {
                const colabOrders = ordersByColab[colab.id] || []
                return (
                  <div
                    key={colab.id}
                    className="bg-white border-2 border-slate-300 rounded-xl p-2.5 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-900">
                          {colab.name}
                        </h4>
                        <span className="text-[9px] font-bold text-slate-500">{colab.vehicle || 'Sem veículo'}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-xs font-black">
                        {colabOrders.length} O.S.
                      </span>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      {colabOrders.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-3 text-center">
                          Nenhum agendamento
                        </p>
                      ) : (
                        colabOrders.map((os) => {
                          const style = getCategoryStyle(os.category, os.subject, os.status)
                          const isExecuting = os.status === 'EX'
                          return (
                            <motion.div
                              key={os.ixcId}
                              animate={
                                isExecuting
                                  ? {
                                      scale: [1, 1.02, 1],
                                      boxShadow: [
                                        '0 0 4px rgba(234,88,12,0.3)',
                                        '0 0 14px rgba(234,88,12,0.7)',
                                        '0 0 4px rgba(234,88,12,0.3)',
                                      ],
                                    }
                                  : { scale: 1 }
                              }
                              transition={
                                isExecuting
                                  ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' }
                                  : { duration: 0.15 }
                              }
                              onClick={() => {
                                setSelectedOS(os)
                                setSelectedOSId(os.ixcId)
                              }}
                              className={`p-2 rounded-lg border-2 ${style.bg} ${style.border} ${
                                isExecuting ? 'ring-2 ring-orange-600' : ''
                              } cursor-pointer hover:shadow transition-all flex flex-col gap-0.5`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black px-1 py-0.2 rounded bg-white/90 text-slate-900 border border-slate-200 flex items-center gap-1">
                                  {os.scheduledTimeStart} - {os.scheduledTimeEnd}
                                  {isExecuting && <span className="animate-pulse text-orange-600 font-black text-[9px]">⚡ EXECUÇÃO</span>}
                                </span>
                                <span className={`text-[10px] font-black ${style.text}`}>
                                  #{os.number}
                                </span>
                              </div>
                              <p className={`text-[11px] font-black truncate ${style.text}`}>
                                {os.subject}
                              </p>
                              <p className="text-[10px] font-bold text-slate-700 truncate">
                                {os.client} - {os.neighborhood}
                              </p>
                            </motion.div>
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

        {/* 3 DIAS / SEMANA / MÊS VIEW MODES */}
        {(agendaViewMode === '3dias' || agendaViewMode === 'semana' || agendaViewMode === 'mes') && (
          <div className="flex-1 p-6 overflow-auto flex flex-col items-center justify-center text-center bg-slate-50">
            <div className="max-w-md bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-xl space-y-4 text-slate-900">
              <CalendarIcon className="w-12 h-12 text-blue-600 mx-auto animate-bounce" />
              <h3 className="text-lg font-black text-slate-900 capitalize">
                Visão de {agendaViewMode === '3dias' ? '3 Dias' : agendaViewMode === 'semana' ? 'Semana' : 'Mês'}
              </h3>
              <p className="text-xs font-semibold text-slate-600">
                Exibindo programação estendida para planejamento de equipes telecom e balanço de carga de trabalho.
              </p>
              <div className="grid grid-cols-2 gap-3 text-left pt-2">
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-300">
                  <span className="text-[10px] text-slate-600 uppercase font-black">Total O.S. Agendadas</span>
                  <p className="text-lg font-black text-blue-600">{serviceOrders.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-300">
                  <span className="text-[10px] text-slate-600 uppercase font-black">Técnicos Ativos</span>
                  <p className="text-lg font-black text-emerald-600">{collaboratorsList.length - 1}</p>
                </div>
              </div>
              <button
                onClick={() => setAgendaViewMode('diaHora')}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg hover:bg-slate-800"
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
            className="fixed bottom-6 right-6 z-50 bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-2xl w-80 pointer-events-none text-slate-900"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-blue-600">O.S. #{hoveredOS.number}</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                {hoveredOS.scheduledTimeStart} - {hoveredOS.scheduledTimeEnd}
              </span>
            </div>
            <h4 className="text-sm font-black text-slate-900 mb-1 leading-snug">{hoveredOS.subject}</h4>
            <p className="text-xs font-bold text-slate-700 mb-2">{hoveredOS.client}</p>
            <div className="space-y-1 text-xs text-slate-600 font-semibold border-t border-slate-200 pt-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate">{hoveredOS.address}, {hoveredOS.neighborhood}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
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
              className="bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 relative overflow-hidden text-slate-900"
            >
              <button
                onClick={() => setSelectedOS(null)}
                className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-100 text-blue-700">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500">Detalhes do Agendamento</span>
                  <h3 className="text-lg font-black text-slate-900">O.S. #{selectedOS.number}</h3>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Assunto:</span>
                  <span className="font-black text-slate-900">{selectedOS.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Cliente:</span>
                  <span className="font-bold text-slate-900">{selectedOS.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Endereço:</span>
                  <span className="font-medium text-slate-800">{selectedOS.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Horário Programado:</span>
                  <span className="font-black text-emerald-600">
                    {selectedOS.scheduledTimeStart} às {selectedOS.scheduledTimeEnd}
                  </span>
                </div>
              </div>

              {/* Reassignment Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
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
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
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
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow-md hover:bg-blue-700 transition"
                >
                  Ver no Mapa Interativo
                </button>
                <button
                  onClick={() => setSelectedOS(null)}
                  className="py-2.5 px-4 bg-slate-200 text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-300"
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
              className="bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 relative text-slate-900"
            >
              <button
                type="button"
                onClick={() => setShowNewOSModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-black text-slate-900">Novo Agendamento de O.S.</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome do Cliente / Local</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Condomínio Grand Park"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assunto da O.S.</label>
                  <input
                    type="text"
                    placeholder="Ex: INSTALAÇÃO VIA FIBRA"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Categoria</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as OSSubjectCategory)}
                      className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-semibold"
                    >
                      <option value="Instalação">Instalação</option>
                      <option value="Sem conexão">Sem Conexão</option>
                      <option value="Lentidão">Lentidão</option>
                      <option value="Mudança de endereço">Mudança</option>
                      <option value="Configuração de roteador">Configuração</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Colaborador</label>
                    <select
                      value={newColabId}
                      onChange={(e) => setNewColabId(e.target.value)}
                      className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-semibold"
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
                    <label className="font-bold text-slate-700 block mb-1">Hora Início</label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Hora Fim</label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md"
                >
                  Salvar Agendamento
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewOSModal(false)}
                  className="py-2.5 px-4 bg-slate-200 text-slate-900 rounded-xl text-xs font-bold"
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
