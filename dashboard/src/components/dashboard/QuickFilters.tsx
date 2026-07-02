import { useDashboardStore } from '@/store/dashboard'

const filters = [
  { key: 'onlineOnly' as const, label: 'Apenas Online', color: '#10b981' },
  { key: 'attendingOnly' as const, label: 'Apenas Atendimento', color: '#f97316' },
  { key: 'installationOnly' as const, label: 'Apenas Instalação', color: '#3b82f6' },
  { key: 'supportOnly' as const, label: 'Apenas Suporte', color: '#8b5cf6' },
  { key: 'fiberOnly' as const, label: 'Apenas Fibra', color: '#06b6d4' },
  { key: 'radioOnly' as const, label: 'Apenas Rádio', color: '#f59e0b' },
  { key: 'urgentOnly' as const, label: 'Apenas Urgentes', color: '#ef4444' },
]

const toggleFilters = [
  { key: 'showTraffic' as const, label: 'Mostrar Trânsito', color: '#3b82f6' },
  { key: 'showHeatmap' as const, label: 'Mostrar Heatmap', color: '#f97316' },
  { key: 'showGeofences' as const, label: 'Mostrar Cercas Virtuais', color: '#10b981' },
]

export function QuickFilters() {
  const filtersState = useDashboardStore((s) => s.filters)
  const setFilter = useDashboardStore((s) => s.setFilter)

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
        Filtros Rápidos
      </p>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key, !filtersState[f.key])}
            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              filtersState[f.key]
                ? 'text-white shadow-sm'
                : 'text-muted-foreground bg-muted/30 hover:bg-muted border border-border/50'
            }`}
            style={filtersState[f.key] ? { backgroundColor: f.color } : {}}
          >
            {filtersState[f.key] ? '✓ ' : ''}{f.label}
          </button>
        ))}
      </div>

      <SeparatorLine />

      <div className="flex flex-col gap-1.5">
        {toggleFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key, !filtersState[f.key])}
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${
              filtersState[f.key]
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            <div
              className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                filtersState[f.key] ? 'bg-primary' : 'bg-muted border border-border'
              }`}
            >
              {filtersState[f.key] && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SeparatorLine() {
  return <div className="h-px bg-border/50 my-2" />
}
