import { Search, RefreshCw, Sparkles } from 'lucide-react'
import { useAppStore, type SourceFilter } from '../../store/useAppStore'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onReassign?: () => void
  onAnalyzeAll?: () => void
  showLegend?: boolean
  showSourceFilter?: boolean
}

const LEGEND = [
  { color: 'var(--color-error-foreground)',   label: 'D-3' },
  { color: 'var(--color-warning-foreground)', label: 'D-7' },
  { color: 'var(--color-success-foreground)', label: 'D-30' },
  { color: '#888',                            label: '채용시' },
]

const SOURCES: { value: SourceFilter; label: string }[] = [
  { value: '',         label: '전체' },
  { value: 'saramin',  label: '사람인' },
  { value: 'jobkorea', label: '잡코리아' },
]

export function TopBar({ search, onSearchChange, onReassign, onAnalyzeAll, showLegend = true, showSourceFilter = true }: Props) {
  const { sourceFilter, setSourceFilter } = useAppStore()

  return (
    <div
      className="flex items-center gap-3 px-6 shrink-0"
      style={{ height: 55, borderBottom: '1px solid var(--border)' }}
    >
      {/* Source filter chips */}
      {showSourceFilter && (
        <div className="flex gap-1">
          {SOURCES.map(({ value, label }) => {
            const active = sourceFilter === value
            return (
              <button
                key={value}
                onClick={() => setSourceFilter(value)}
                className="px-3 h-[30px] rounded-full text-xs font-medium transition-colors"
                style={{
                  background: active ? 'var(--brand-primary)' : 'var(--secondary)',
                  color: active ? '#fff' : 'var(--muted-foreground)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 h-[34px]"
        style={{ background: 'var(--secondary)', border: '1px solid var(--border)', width: 240 }}
      >
        <Search size={12} style={{ color: 'var(--muted-foreground)' }} />
        <input
          className="flex-1 bg-transparent outline-none text-xs"
          style={{ color: 'var(--foreground)' }}
          placeholder="공고명·회사명 검색"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* D Badge legend */}
      {showLegend && (
        <div className="flex items-center gap-4 rounded-lg px-3 py-2" style={{ background: 'var(--secondary)' }}>
          {LEGEND.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {onReassign && (
        <button
          onClick={onReassign}
          className="flex items-center gap-1.5 px-3 h-[30px] rounded-lg text-xs"
          style={{ background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <RefreshCw size={12} /> 재분류
        </button>
      )}

      {onAnalyzeAll && (
        <button
          onClick={onAnalyzeAll}
          className="flex items-center gap-1.5 px-3 h-[30px] rounded-lg text-xs"
          style={{ background: 'var(--color-info)', color: 'var(--color-info-foreground)' }}
        >
          <Sparkles size={12} /> AI 전체분석
        </button>
      )}
    </div>
  )
}
