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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
        height: 55,
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* 소스 필터 칩 */}
      {showSourceFilter && (
        <div style={{ display: 'flex', gap: 4 }}>
          {SOURCES.map(({ value, label }) => {
            const active = sourceFilter === value
            return (
              <button
                key={value}
                onClick={() => setSourceFilter(value)}
                style={{
                  padding: '5px 14px',
                  height: 30,
                  borderRadius: 16,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'var(--brand-primary)' : 'var(--secondary)',
                  color: active ? '#fff' : 'var(--muted-foreground)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* 검색창 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          height: 34,
          width: 240,
          borderRadius: 8,
          background: 'var(--secondary)',
          border: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Search size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        <input
          style={{
            flex: 1,
            background: 'transparent',
            outline: 'none',
            border: 'none',
            fontSize: 12,
            color: 'var(--foreground)',
          }}
          placeholder="공고명·회사명 검색"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* D Badge 범례 */}
      {showLegend && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'var(--secondary)',
          }}
        >
          {LEGEND.map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {onReassign && (
        <button
          onClick={onReassign}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            height: 30,
            borderRadius: 8,
            fontSize: 12,
            background: 'var(--secondary)',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> 재분류
        </button>
      )}

      {onAnalyzeAll && (
        <button
          onClick={onAnalyzeAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            height: 30,
            borderRadius: 8,
            fontSize: 12,
            background: 'var(--color-info)',
            color: 'var(--color-info-foreground)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={12} /> AI 전체분석
        </button>
      )}
    </div>
  )
}
