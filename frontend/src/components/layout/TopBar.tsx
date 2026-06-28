import { useRef, useState, useEffect } from 'react'
import { Search, RefreshCw, Sparkles, ArrowUpDown, Check } from 'lucide-react'
import { useAppStore, type SourceFilter } from '../../store/useAppStore'

export type SortBy = 'deadline' | 'recent' | 'ongoing'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'deadline', label: '마감일순' },
  { value: 'recent',   label: '최근 저장순' },
  { value: 'ongoing',  label: '상시채용' },
]

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onReassign?: () => void
  onAnalyzeAll?: () => void
  showLegend?: boolean
  showSourceFilter?: boolean
  sort?: SortBy
  onSortChange?: (s: SortBy) => void
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

export function TopBar({ search, onSearchChange, onReassign, onAnalyzeAll, showLegend = true, showSourceFilter = true, sort, onSortChange }: Props) {
  const { sourceFilter, setSourceFilter } = useAppStore()
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sortOpen) return
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [sortOpen])

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

      {onSortChange && (
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSortOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', height: 30, borderRadius: 8, fontSize: 12,
              background: sort && sort !== 'recent' ? 'var(--brand-primary-bg)' : 'var(--secondary)',
              border: sort && sort !== 'recent' ? '1px solid var(--brand-primary)' : '1px solid var(--border)',
              color: sort && sort !== 'recent' ? 'var(--brand-primary)' : 'var(--muted-foreground)',
              cursor: 'pointer',
            }}
          >
            <ArrowUpDown size={12} />
            {SORT_OPTIONS.find((o) => o.value === (sort ?? 'recent'))?.label}
          </button>
          {sortOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden', minWidth: 130,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}>
              {SORT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { onSortChange(value); setSortOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 14px', fontSize: 12, border: 'none',
                    background: sort === value ? 'var(--brand-primary-bg)' : 'transparent',
                    color: sort === value ? 'var(--brand-primary)' : 'var(--foreground)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {label}
                  {sort === value && <Check size={11} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
