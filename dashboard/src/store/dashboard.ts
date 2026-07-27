import { create } from 'zustand'
import type { TeamMember, ServiceOrder, DashboardStats, Alert } from '@/types'
import { getTodayDateString } from '@/lib/utils'

interface DashboardState {
  teams: Record<string, TeamMember>
  serviceOrders: ServiceOrder[]
  stats: DashboardStats | null
  alerts: Alert[]
  selectedTeamId: string | null
  selectedOSId: string | null
  isAuthenticated: boolean
  searchQuery: string
  filters: {
    onlineOnly: boolean
    attendingOnly: boolean
    installationOnly: boolean
    supportOnly: boolean
    fiberOnly: boolean
    radioOnly: boolean
    urgentOnly: boolean
    showTraffic: boolean
    showHeatmap: boolean
    showGeofences: boolean
  }
  theme: 'dark' | 'light'

  activeTab: 'monitor' | 'agenda' | 'history' | 'reports' | 'notifications'
  agendaViewMode: 'diaHora' | 'diaColaborador' | '3dias' | 'semana' | 'mes'
  selectedAgendaDate: string
  agendaSearchQuery: string

  setActiveTab: (tab: 'monitor' | 'agenda' | 'history' | 'reports' | 'notifications') => void
  setAgendaViewMode: (mode: 'diaHora' | 'diaColaborador' | '3dias' | 'semana' | 'mes') => void
  setSelectedAgendaDate: (date: string) => void
  setAgendaSearchQuery: (query: string) => void
  reassignOSSchedule: (osId: string, teamId: string, collaboratorName: string, startTime?: string, endTime?: string) => void
  addNewOSSchedule: (os: ServiceOrder) => void

  setTeams: (teams: Record<string, TeamMember>) => void
  updateTeam: (id: string, data: Partial<TeamMember>) => void
  removeTeam: (id: string) => void
  setServiceOrders: (orders: ServiceOrder[]) => void
  setStats: (stats: DashboardStats) => void
  addAlert: (alert: Alert) => void
  removeAlert: (id: string) => void
  setSelectedTeamId: (id: string | null) => void
  setSelectedOSId: (id: string | null) => void
  setAuthenticated: (val: boolean) => void
  setSearchQuery: (q: string) => void
  setFilter: (key: keyof DashboardState['filters'], value: boolean) => void
  toggleTheme: () => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  teams: {},
  serviceOrders: [],
  stats: null,
  alerts: [],
  selectedTeamId: null,
  selectedOSId: null,
  isAuthenticated: !!localStorage.getItem('m_token'),
  searchQuery: '',
  activeTab: 'monitor',
  agendaViewMode: 'diaHora',
  selectedAgendaDate: getTodayDateString(),
  agendaSearchQuery: '',
  filters: {
    onlineOnly: false,
    attendingOnly: false,
    installationOnly: false,
    supportOnly: false,
    fiberOnly: false,
    radioOnly: false,
    urgentOnly: false,
    showTraffic: false,
    showHeatmap: false,
    showGeofences: false,
  },
  theme: (localStorage.getItem('m_theme') as 'dark' | 'light') || 'dark',

  setActiveTab: (activeTab) => set({ activeTab }),
  setAgendaViewMode: (agendaViewMode) => set({ agendaViewMode }),
  setSelectedAgendaDate: (selectedAgendaDate) => set({ selectedAgendaDate }),
  setAgendaSearchQuery: (agendaSearchQuery) => set({ agendaSearchQuery }),
  reassignOSSchedule: (osId, teamId, collaboratorName, startTime, endTime) =>
    set((state) => ({
      serviceOrders: state.serviceOrders.map((os) =>
        os.ixcId === osId
          ? {
              ...os,
              teamId,
              collaboratorName,
              ...(startTime ? { scheduledTimeStart: startTime } : {}),
              ...(endTime ? { scheduledTimeEnd: endTime } : {}),
            }
          : os
      ),
    })),
  addNewOSSchedule: (newOs) =>
    set((state) => ({
      serviceOrders: [newOs, ...state.serviceOrders],
    })),

  setTeams: (teams) => set({ teams }),
  updateTeam: (id, data) =>
    set((state) => ({
      teams: { ...state.teams, [id]: { ...state.teams[id], ...data } },
    })),
  removeTeam: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.teams
      return { teams: rest }
    }),
  setServiceOrders: (orders) => set({ serviceOrders: orders }),
  setStats: (stats) => set({ stats }),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50),
    })),
  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),
  setSelectedTeamId: (id) => set({ selectedTeamId: id }),
  setSelectedOSId: (id) => set({ selectedOSId: id }),
  setAuthenticated: (val) => set({ isAuthenticated: val }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('m_theme', next)
      return { theme: next }
    }),
}))
