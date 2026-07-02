import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useDashboardStore } from '@/store/dashboard'
import { STATUS_MAP, type TeamMember, type ServiceOrder } from '@/types'

function DarkTileLayer() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    />
  )
}

function TechMarker({ team }: { team: TeamMember }) {
  if (!team.lastLocation?.lat || !team.lastLocation?.lng) return null

  const isOnline = team.status === 'Online'
  const bgColor = isOnline ? '#3b82f6' : '#6b7280'
  const speed = team.lastLocation.speed || 0
  const label = speed > 2 ? `${team.name} • ${Math.round(speed)} km/h` : team.name

  const icon = L.divIcon({
    className: '!bg-transparent !border-none',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="background:rgba(15,23,42,0.85);backdrop-filter:blur(4px);color:white;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;border:1px solid rgba(56,189,248,0.4);margin-bottom:3px;box-shadow:0 2px 8px rgba(0,0,0,0.35);white-space:nowrap;letter-spacing:0.3px;">
          ${label}
        </div>
        <div style="background-color:${bgColor};width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2.5px solid white;box-shadow:0 4px 15px rgba(0,0,0,0.4);color:white;transition:transform 0.5s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        </div>
      </div>
    `,
    iconSize: [30, 50],
    iconAnchor: [15, 42],
  })

  return (
    <Marker position={[team.lastLocation.lat, team.lastLocation.lng]} icon={icon}>
      <Popup>
        <div className="min-w-[180px] p-1">
          <div className="font-extrabold text-sm mb-1">{team.name}</div>
          <div className="text-xs space-y-0.5 text-muted-foreground">
            <div>Status: {team.status}</div>
            {team.battery !== undefined && <div>Bateria: {Math.round(team.battery)}%</div>}
            {speed > 2 && <div>Velocidade: {Math.round(speed)} km/h</div>}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

function OSMarker({ os }: { os: ServiceOrder }) {
  if (!os.lat || !os.lng) return null

  const statusInfo = STATUS_MAP[os.status as keyof typeof STATUS_MAP] || { label: 'Outro', color: '#6b7280', icon: 'help-circle' }

  const icon = L.divIcon({
    className: '!bg-transparent !border-none',
    html: `
      <div style="background:${statusInfo.color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3);color:white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${statusInfo.icon === 'truck' ? '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>' : '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'}
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  return (
    <Marker position={[os.lat, os.lng]} icon={icon}>
      <Popup>
        <div className="min-w-[200px] p-1">
          <div className="flex justify-between items-center mb-2 border-b pb-1">
            <span className="font-extrabold text-sm">OS {os.number}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color, border: `1px solid ${statusInfo.color}40` }}>
              {statusInfo.label}
            </span>
          </div>
          <div className="text-xs space-y-1 text-muted-foreground">
            <p><b>Cliente:</b> {os.client}</p>
            <p><b>Assunto:</b> {os.subject || 'N/I'}</p>
            <p className="text-xs flex items-center gap-1" style={{ color: statusInfo.color, fontWeight: 700 }}>
              <b>Status:</b> {statusInfo.label}
            </p>
            <p className="text-[11px] text-muted-foreground/70 bg-muted p-1.5 rounded-lg flex items-start gap-1.5 mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" className="mt-0.5 flex-shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              {os.address || 'Endereço não informado'}
            </p>
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
          (t) => t.id === os.teamId || t.name === os.teamId
        )
        if (!team?.lastLocation?.lat || !team?.lastLocation?.lng) return null
        const statusInfo = STATUS_MAP[os.status as keyof typeof STATUS_MAP] || { color: '#f59e0b' }
        return {
          id: os.ixcId,
          from: [team.lastLocation.lat, team.lastLocation.lng] as [number, number],
          to: [os.lat, os.lng] as [number, number],
          color: statusInfo.color,
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
            opacity: 0.5,
            dashArray: '8, 8',
          }}
        />
      ))}
    </>
  )
}

function MapController() {
  const map = useMap()

  useEffect(() => {
    map.setView([-2.53, -44.3], 12)
  }, [map])

  return null
}

export function MapView() {
  const teams = useDashboardStore((s) => s.teams)
  const orders = useDashboardStore((s) => s.serviceOrders)

  return (
    <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-border shadow-2xl">
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[-2.53, -44.3]}
          zoom={12}
          className="h-full w-full"
          zoomControl={false}
        >
          <DarkTileLayer />
          <MapController />
          <RouteLines />
          {Object.values(teams).map((team) => (
            <TechMarker key={team.id} team={team} />
          ))}
          {orders.map((os) => (
            <OSMarker key={os.ixcId} os={os} />
          ))}
        </MapContainer>
      </div>

      <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-1 bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-1.5 shadow-xl">
        <MapControlButton label="Mapa Padrão" />
        <MapControlButton label="Satélite" />
        <MapControlButton label="Centralizar" />
        <MapControlButton label="Agrupar" />
        <MapControlButton label="Trânsito" />
      </div>
    </div>
  )
}

function MapControlButton({ label }: { label: string }) {
  return (
    <button
      title={label}
      className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all"
    >
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
      </svg>
    </button>
  )
}
