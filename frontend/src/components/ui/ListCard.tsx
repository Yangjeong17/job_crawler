import { ExternalLink, Heart, ThumbsDown, Bookmark, Sparkles } from 'lucide-react'
import type { Job } from '../../types/job'
import { DBadge } from './DBadge'

function daysLeft(deadline: string): number | null {
  const m = deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  const target = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}

function ddayChipStyle(days: number | null): { bg: string; fg: string; label: string } {
  if (days === null) return { bg: 'transparent', fg: 'transparent', label: '' }
  if (days < 0)  return { bg: 'var(--secondary)', fg: '#555', label: '마감' }
  if (days <= 3) return { bg: 'var(--color-error)',   fg: 'var(--color-error-foreground)',   label: `D-${days}` }
  if (days <= 7) return { bg: 'var(--color-warning)', fg: 'var(--color-warning-foreground)', label: `D-${days}` }
  return { bg: 'var(--color-success)', fg: 'var(--color-success-foreground)', label: `D-${days}` }
}

interface Props {
  job: Job
  onNotInterested?: () => void
  onSave?: () => void
  onFavorite?: () => void
  onAnalyze?: () => void
}

export function ListCard({ job, onNotInterested, onSave, onFavorite, onAnalyze }: Props) {
  const days = job.deadline ? daysLeft(job.deadline) : null
  const chip = days !== null ? ddayChipStyle(days) : null

  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        minHeight: 80,
      }}
    >
      <DBadge deadline={job.deadline} />

      {/* 공고 정보 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, padding: '12px 12px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500, background: 'var(--color-info)', color: 'var(--color-info-foreground)' }}>
            {job.source}
          </span>
          {chip && chip.label && (
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: chip.bg, color: chip.fg }}>
              {chip.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--foreground)' }}>
          {job.title}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)' }}>
          {job.company}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted-foreground)' }}>
          {job.location && <span>{job.location}</span>}
          {job.experience && <span>{job.experience}</span>}
          {job.deadline && <span>마감: {job.deadline}</span>}
        </div>
      </div>

      {/* 액션 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', flexShrink: 0 }}>
        {/* 버튼 1줄: 관심없음 → 저장 → 즐겨찾기 → 공고보기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onNotInterested && (
            <button onClick={onNotInterested} className="btn-sm btn-error">
              <ThumbsDown size={12} /> 관심없음
            </button>
          )}
          {onSave && (
            <button onClick={onSave} className="btn-sm btn-warning">
              <Bookmark size={12} /> 저장
            </button>
          )}
          {onFavorite && (
            <button onClick={onFavorite} className="btn-sm btn-success">
              <Heart size={12} /> 즐겨찾기
            </button>
          )}
          <a href={job.url} target="_blank" rel="noreferrer" className="btn-sm btn-secondary">
            <ExternalLink size={12} /> 공고 보기
          </a>
        </div>

        {/* 상세분석 — 별도 줄 */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="btn-sm btn-info"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Sparkles size={12} /> 상세분석
          </button>
        )}
      </div>
    </div>
  )
}
