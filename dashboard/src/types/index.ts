export type TechStatus =
  | 'Disponível'
  | 'Em deslocamento'
  | 'Executando atendimento'
  | 'Aguardando cliente'
  | 'Em intervalo'
  | 'Offline'

export const TECH_STATUS_CONFIG: Record<TechStatus, { label: string; color: string; icon: string; bg: string }> = {
  'Disponível': { label: 'Disponível', color: '#22c55e', icon: 'check-circle-2', bg: 'rgba(34, 197, 94, 0.15)' },
  'Em deslocamento': { label: 'Em Deslocamento', color: '#3b82f6', icon: 'navigation', bg: 'rgba(59, 130, 246, 0.15)' },
  'Executando atendimento': { label: 'Executando O.S.', color: '#f97316', icon: 'wrench', bg: 'rgba(249, 115, 22, 0.15)' },
  'Aguardando cliente': { label: 'Aguardando Cliente', color: '#8b5cf6', icon: 'clock', bg: 'rgba(139, 92, 246, 0.15)' },
  'Em intervalo': { label: 'Em Intervalo', color: '#eab308', icon: 'coffee', bg: 'rgba(234, 179, 8, 0.15)' },
  'Offline': { label: 'Offline', color: '#64748b', icon: 'wifi-off', bg: 'rgba(100, 116, 139, 0.15)' },
}

export type OSSubjectCategory =
  | 'Sem conexão'
  | 'Fibra rompida'
  | 'Lentidão'
  | 'Instalação'
  | 'Mudança de endereço'
  | 'Configuração de roteador'
  | 'Retirada de equipamentos'

export const OS_CATEGORY_CONFIG: Record<OSSubjectCategory, { label: string; color: string; icon: string; badge: string }> = {
  'Sem conexão': { label: 'Sem conexão', color: '#EF4444', icon: 'wifi-off', badge: '🔴 Sem Conexão' },
  'Fibra rompida': { label: 'Fibra rompida', color: '#F97316', icon: 'scissors', badge: '🟠 Fibra Rompida' },
  'Lentidão': { label: 'Lentidão / Oscilação', color: '#EAB308', icon: 'activity', badge: '🟡 Lentidão' },
  'Instalação': { label: 'Nova Instalação', color: '#10B981', icon: 'plus-circle', badge: '🟢 Instalação' },
  'Mudança de endereço': { label: 'Mudança de Endereço', color: '#3B82F6', icon: 'map-pin', badge: '🔵 Mudança' },
  'Configuração de roteador': { label: 'Config. Roteador', color: '#8B5CF6', icon: 'settings', badge: '🟣 Configuração' },
  'Retirada de equipamentos': { label: 'Retirada de Equip.', color: '#64748B', icon: 'box', badge: '⚫ Retirada' },
}

export interface TeamMember {
  id: string
  name: string
  status: TechStatus
  techs?: string[]
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
  region?: string
  city?: string
  neighborhood?: string
  currentOSId?: string
  activityTimeMinutes?: number
  role?: string
  photo?: string
  connectionType?: string
}

export interface ServiceOrder {
  ixcId: string
  number: string
  client: string
  address: string
  neighborhood?: string
  city?: string
  phone?: string
  whatsapp?: string
  subject: string
  category: OSSubjectCategory
  technology?: string
  priority: 'critica' | 'alta' | 'media' | 'baixa'
  status: 'A' | 'DS' | 'EX' | 'F' | 'AG' | 'EN' | 'AS'
  lat?: number
  lng?: number
  teamId?: string
  teamName?: string
  scheduledDate?: string
  openedAt?: string
  slaMinutes?: number
  slaRemainingMinutes?: number
  ctoName?: string
  ctoPort?: string
  rxSignal?: number
  txSignal?: number
  distance?: number
  eta?: string
  equipment?: string
  type?: string
  delay?: number
}

export interface IncidentCluster {
  id: string
  title: string
  category: OSSubjectCategory
  city: string
  neighborhood: string
  ctoName?: string
  affectedCount: number
  lat: number
  lng: number
  osIds: string[]
  severity: 'critica' | 'alta' | 'media'
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
  avgDriveTime?: number
  avgServiceTime?: number
  slaComplianceRate?: number
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
  title?: string
  message: string
  technician?: string
  neighborhood?: string
  osId?: string
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
  DS: { label: 'Deslocamento', color: '#3b82f6', icon: 'truck' },
  EX: { label: 'Execução', color: '#f97316', icon: 'wrench' },
  F: { label: 'Finalizado', color: '#10b981', icon: 'check-circle' },
  AG: { label: 'Agendado', color: '#14b8a6', icon: 'calendar' },
  EN: { label: 'Encaminhado', color: '#6366f1', icon: 'send' },
  AS: { label: 'Assumido', color: '#8b5cf6', icon: 'user-check' },
}

