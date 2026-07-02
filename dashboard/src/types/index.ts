export interface TeamMember {
  id: string
  name: string
  status: 'Online' | 'Offline'
  battery?: number
  lastLocation?: {
    lat: number
    lng: number
    speed?: number
    heading?: number
  }
  lastSeen?: string
  phone?: string
  vehicle?: string
  plate?: string
  role?: string
  photo?: string
  connectionType?: string
}

export interface ServiceOrder {
  ixcId: string
  number: string
  client: string
  address: string
  phone?: string
  whatsapp?: string
  subject?: string
  technology?: string
  priority?: string
  status: string
  lat?: number
  lng?: number
  teamId?: string
  scheduledDate?: string
  distance?: number
  eta?: string
  equipment?: string
  type?: string
  delay?: number
}

export interface DashboardStats {
  active: number
  total: number
  osToday: number
  osDone: number
  osProgress: number
  osPending: number
  avgTime: number
  completionRate: number
  osOpen: number
  osOverdue: number
  clientsWaiting: number
  onlineTechs: number
  attendingTechs: number
  drivingTechs: number
  stoppedTechs: number
  offlineTechs: number
}

export interface Activity {
  id: string
  message: string
  type: string
  timestamp: string
}

export interface Alert {
  id: string
  type: 'warning' | 'danger' | 'info' | 'success'
  message: string
  technician?: string
  timestamp: Date
}

export type OSStatus =
  | 'A'
  | 'DS'
  | 'EX'
  | 'F'
  | 'AG'
  | 'EN'
  | 'AS'

export const STATUS_MAP: Record<OSStatus, { label: string; color: string; icon: string }> = {
  A: { label: 'Aberto', color: '#3b82f6', icon: 'info' },
  DS: { label: 'Deslocamento', color: '#f59e0b', icon: 'truck' },
  EX: { label: 'Execução', color: '#ec4899', icon: 'wrench' },
  F: { label: 'Finalizado', color: '#10b981', icon: 'check-circle' },
  AG: { label: 'Agendado', color: '#14b8a6', icon: 'calendar' },
  EN: { label: 'Encaminhado', color: '#6366f1', icon: 'send' },
  AS: { label: 'Assumido', color: '#8b5cf6', icon: 'user-check' },
}
