import { useMemo, useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useDashboardStore } from '@/store/dashboard'
import {
  TECH_STATUS_CONFIG,
  OS_CATEGORY_CONFIG,
  type TeamMember,
  type ServiceOrder,
  type OSSubjectCategory,
} from '@/types'
import { MOCK_CLUSTERS } from '@/services/mockData'
import { Layers, Eye, AlertTriangle } from 'lucide-react'

// Tile Provider Configurations
const TILE_PROVIDERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO Voyager',
  },
}

function TechMarker({
  team,
  isSelected,
  onClick,
}: {
  team: TeamMember
  isSelected: boolean
  onClick: () => void
}) {
  if (!team.lastLocation?.lat || !team.lastLocation?.lng) return null

  const statusConfig = TECH_STATUS_CONFIG[team.status] || TECH_STATUS_CONFIG['Offline']
  const speed = team.lastLocation.speed || 0
  const speedLabel = speed > 2 ? ` • ${Math.round(speed)} km/h` : ''
  const isMoving = speed > 5

  const icon = L.divIcon({
    className: '!bg-transparent !border-none',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;${isSelected ? 'transform:scale(1.15);z-index:999;' : ''}">
        <div style="background:rgba(15,23,42,0.9);backdrop-filter:blur(6px);color:white;padding:3px 8px;border-radius:6px;font-weight:700;font-size:10px;border:1px solid ${statusConfig.color};margin-bottom:4px;box-shadow:0 4px 12px rgba(0,0,0,0.5);white-space:nowrap;letter-spacing:0.3px;display:flex;align-items:center;gap:4px;">
          <span style="width:6px;height:6px;border-radius:50%;background:${statusConfig.color};"></span>
          ${team.name.split(' ')[0]} ${team.name.split(' ')[1] || ''}${speedLabel}
        </div>
        <div style="position:relative;background:${statusConfig.color};width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid ${isSelected ? '#38bdf8' : 'white'};box-shadow:0 6px 20px rgba(0,0,0,0.4);color:white;transition:all 0.3s;">
          ${isMoving ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px dashed ${statusConfig.color};animation:spin 6s linear infinite;"></div>` : ''}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 60],
    iconAnchor: [20, 52],
  })

  return (
    <Marker
      position={[team.lastLocation.lat, team.lastLocation.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div style={{ color: '#ffffff' }} className="min-w-[240px] p-2 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <span style={{ color: '#ffffff' }} className="font-extrabold text-sm">{team.name}</span>
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
          </div>
          <div className="text-xs space-y-1.5" style={{ color: '#e2e8f0' }}>
            {team.techs && <div><b style={{ color: '#94a3b8' }}>Técnicos:</b> <span style={{ color: '#ffffff' }} className="font-semibold">{team.techs.join(', ')}</span></div>}
            {team.vehicle && <div><b style={{ color: '#94a3b8' }}>Veículo:</b> <span style={{ color: '#ffffff' }}>{team.vehicle} ({team.plate})</span></div>}
            {team.phone && <div><b style={{ color: '#94a3b8' }}>Telefone:</b> <span style={{ color: '#38bdf8' }} className="font-bold">{team.phone}</span></div>}
            {team.battery !== undefined && <div><b style={{ color: '#94a3b8' }}>Bateria:</b> <span style={{ color: '#34d399' }} className="font-bold">{team.battery}% 🔋</span></div>}
            {team.currentOSId && <div><b style={{ color: '#94a3b8' }}>O.S. Atual:</b> <span style={{ color: '#38bdf8' }} className="font-bold">#{team.currentOSId.replace('os-', '')}</span></div>}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

function OSMarker({
  os,
  isSelected,
  onClick,
}: {
  os: ServiceOrder
  isSelected: boolean
  onClick: () => void
}) {
  if (!os.lat || !os.lng) return null

  const categoryConfig = OS_CATEGORY_CONFIG[os.category as OSSubjectCategory] || OS_CATEGORY_CONFIG['Sem conexão']
  const isCritical = os.priority === 'critica' || os.category === 'Sem conexão' || os.category === 'Fibra rompida'

  const icon = L.divIcon({
    className: '!bg-transparent !border-none',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;${isSelected ? 'transform:scale(1.25);z-index:999;' : ''}">
        ${
          isCritical
            ? `<div style="position:absolute;width:34px;height:34px;border-radius:50%;background:${categoryConfig.color};opacity:0.4;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>`
            : ''
        }
        <div style="background:${categoryConfig.color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid ${isSelected ? '#38bdf8' : 'white'};box-shadow:0 4px 15px rgba(0,0,0,0.4);color:white;z-index:2;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })

  return (
    <Marker
      position={[os.lat, os.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div style={{ color: '#ffffff' }} className="min-w-[260px] p-2 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <span style={{ color: '#ffffff' }} className="font-extrabold text-sm">O.S. #{os.number}</span>
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${categoryConfig.color}30`, color: categoryConfig.color, border: `1px solid ${categoryConfig.color}60` }}
            >
              {categoryConfig.badge}
            </span>
          </div>
          <div className="text-xs space-y-1.5" style={{ color: '#e2e8f0' }}>
            <div><b style={{ color: '#94a3b8' }}>Cliente:</b> <span style={{ color: '#ffffff' }} className="font-extrabold">{os.client}</span></div>
            <div><b style={{ color: '#94a3b8' }}>Endereço:</b> <span style={{ color: '#f1f5f9' }} className="font-semibold">{os.address || 'Não informado'}</span></div>
            {os.neighborhood && <div><b style={{ color: '#94a3b8' }}>Bairro/Cidade:</b> <span style={{ color: '#e2e8f0' }}>{os.neighborhood} - {os.city || 'São Luís'}</span></div>}
            <div><b style={{ color: '#94a3b8' }}>Assunto:</b> <span style={{ color: '#38bdf8' }} className="font-bold">{os.subject}</span></div>
            {os.ctoName && (
              <div className="bg-slate-800/90 border border-slate-700 p-2 rounded-lg flex items-center justify-between font-mono text-[11px]">
                <span style={{ color: '#cbd5e1' }}>CTO: <b style={{ color: '#ffffff' }}>{os.ctoName}</b></span>
                {os.rxSignal !== undefined && (
                  <span className={`font-bold ${os.rxSignal < -27 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {os.rxSignal} dBm
                  </span>
                )}
              </div>
            )}
            {os.slaRemainingMinutes !== undefined && (
              <div className="flex items-center justify-between text-[11px] font-bold pt-1" style={{ color: '#cbd5e1' }}>
                <span>SLA Restante:</span>
                <span className={os.slaRemainingMinutes < 60 ? 'text-red-400 animate-pulse font-extrabold' : 'text-amber-400'}>
                  ⏱ {os.slaRemainingMinutes} min
                </span>
              </div>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

function RouteLines() {
  const teams = useDashboardStore((s) => s.teams)
  const orders = useDashboardStore((s) => s.serviceOrders)

  const lines = useMemo(() => {
    return orders
      .filter((os) => os.status === 'DS' && os.teamId && os.lat && os.lng)
      .map((os) => {
        const team = Object.values(teams).find(
          (t) => t.id === os.teamId || t.name.includes(os.teamId || '')
        )
        if (!team?.lastLocation?.lat || !team?.lastLocation?.lng) return null
        return {
          id: os.ixcId,
          from: [team.lastLocation.lat, team.lastLocation.lng] as [number, number],
          to: [os.lat, os.lng] as [number, number],
          color: '#3b82f6',
        }
      })
      .filter(Boolean) as { id: string; from: [number, number]; to: [number, number]; color: string }[]
  }, [teams, orders])

  return (
    <>
      {lines.map((line) => (
        <Polyline
          key={line.id}
          positions={[line.from, line.to]}
          pathOptions={{
            color: line.color,
            weight: 3,
            opacity: 0.8,
            dashArray: '8, 12',
          }}
        />
      ))}
    </>
  )
}

function ClusterOverlays() {
  return (
    <>
      {MOCK_CLUSTERS.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          radius={45}
          pathOptions={{
            color: c.severity === 'critica' ? '#ef4444' : '#f97316',
            fillColor: c.severity === 'critica' ? '#ef4444' : '#f97316',
            fillOpacity: 0.25,
            weight: 2,
            dashArray: '4, 4',
          }}
        >
          <Popup>
            <div className="min-w-[220px] p-2 space-y-1">
              <div className="font-extrabold text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {c.title}
              </div>
              <div className="text-xs text-muted-foreground">
                <p><b>Afetados:</b> {c.affectedCount} Assinantes</p>
                <p><b>Bairro:</b> {c.neighborhood} ({c.city})</p>
                <p><b>Equipamento Ref:</b> {c.ctoName}</p>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}

function MapController() {
  const map = useMap()
  const selectedOSId = useDashboardStore((s) => s.selectedOSId)
  const selectedTeamId = useDashboardStore((s) => s.selectedTeamId)
  const orders = useDashboardStore((s) => s.serviceOrders)
  const teams = useDashboardStore((s) => s.teams)

  useEffect(() => {
    if (selectedOSId) {
      const os = orders.find((o) => o.ixcId === selectedOSId)
      if (os?.lat && os?.lng) {
        map.flyTo([os.lat, os.lng], 15, { duration: 1.2 })
      }
    } else if (selectedTeamId) {
      const team = teams[selectedTeamId]
      if (team?.lastLocation?.lat && team?.lastLocation?.lng) {
        map.flyTo([team.lastLocation.lat, team.lastLocation.lng], 15, { duration: 1.2 })
      }
    }
  }, [selectedOSId, selectedTeamId, orders, teams, map])

  return null
}

export function MapView() {
  const teams = useDashboardStore((s) => s.teams)
  const orders = useDashboardStore((s) => s.serviceOrders)
  const selectedOSId = useDashboardStore((s) => s.selectedOSId)
  const selectedTeamId = useDashboardStore((s) => s.selectedTeamId)
  const setSelectedOSId = useDashboardStore((s) => s.setSelectedOSId)
  const setSelectedTeamId = useDashboardStore((s) => s.setSelectedTeamId)
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite' | 'light'>('dark')
  const [showClusters, setShowClusters] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)

  const activeProvider = TILE_PROVIDERS[mapStyle]

  return (
    <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-border shadow-2xl">
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[-2.525, -44.27]}
          zoom={13}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer attribution={activeProvider.attribution} url={activeProvider.url} />
          <MapController />
          {showRoutes && <RouteLines />}
          {showClusters && <ClusterOverlays />}
          {Object.values(teams).map((team) => (
            <TechMarker
              key={team.id}
              team={team}
              isSelected={selectedTeamId === team.id}
              onClick={() => {
                setSelectedTeamId(team.id)
                if (team.currentOSId) setSelectedOSId(team.currentOSId)
              }}
            />
          ))}
          {orders.map((os) => (
            <OSMarker
              key={os.ixcId}
              os={os}
              isSelected={selectedOSId === os.ixcId}
              onClick={() => setSelectedOSId(os.ixcId)}
            />
          ))}
        </MapContainer>
      </div>

      {/* Floating Map Controls */}
      <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2 bg-card/90 backdrop-blur-xl border border-border rounded-2xl p-2 shadow-2xl">
        <button
          onClick={() => setMapStyle(mapStyle === 'dark' ? 'satellite' : mapStyle === 'satellite' ? 'light' : 'dark')}
          title="Alternar Camada do Mapa"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary/70 hover:bg-primary hover:text-primary-foreground transition-all"
        >
          <Layers className="w-4 h-4" />
          <span className="capitalize">{mapStyle}</span>
        </button>

        <button
          onClick={() => setShowClusters(!showClusters)}
          title="Alternar Clusters de Falha Massiva"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            showClusters ? 'bg-destructive/20 text-destructive border border-destructive/40' : 'bg-secondary/50 text-muted-foreground'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Incidentes</span>
        </button>

        <button
          onClick={() => setShowRoutes(!showRoutes)}
          title="Alternar Rotas em Deslocamento"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            showRoutes ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-secondary/50 text-muted-foreground'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Rotas</span>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute left-4 bottom-4 z-[1000] bg-card/90 backdrop-blur-xl border border-border rounded-xl p-3 shadow-xl hidden md:flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground">
        <div className="text-foreground font-extrabold border-b pb-1 mb-1">Legenda ISP</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Sem Conexão
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" /> Fibra Rompida
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Nova Instalação
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> Equipe Disponível
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Em Deslocamento
        </div>
      </div>
    </div>
  )
}
