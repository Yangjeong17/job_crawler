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
      className="flex rounded-lg overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <DBadge deadline={job.deadline} />

      <div className="flex flex-col gap-1 flex-1 p-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--color-info)', color: 'var(--color-info-foreground)' }}>
            {job.source}
          </span>
          {chip && chip.label && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: chip.bg, color: chip.fg }}>
              {chip.label}
            </span>
          )}
        </div>
        <div className="text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
          {job.title}
        </div>
        <div className="text-xs" style={{ color: 'var(--brand-primary)' }}>
          {job.company}
        </div>
        <div className="flex gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {job.location && <span>{job.location}</span>}
          {job.experience && <span>{job.experience}</span>}
          {job.deadline && <span>마감: {job.deadline}</span>}
        </div>
      </div>

      <div className="flex flex-col items-end justify-center gap-2 p-3 shrink-0">
        <div className="flex gap-2">
          {onNotInterested && (
            <button onClick={onNotInterested} className="btn-sm btn-error">
              <ThumbsDown size={11} /> 관심없음
            </button>
          )}
          {onFavorite && (
            <button onClick={onFavorite} className="btn-sm btn-success">
              <Heart size={11} /> 즐겨찾기
            </button>
          )}
          {onSave && (
            <button onClick={onSave} className="btn-sm btn-warning">
              <Bookmark size={11} /> 저장
            </button>
          )}
          {onAnalyze && (
            <button onClick={onAnalyze} className="btn-sm btn-info">
              <Sparkles size={11} /> 상세분석
            </button>
          )}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="btn-sm btn-secondary"
          >
            <ExternalLink size={11} /> 공고 보기
          </a>
        </div>
      </div>
    </div>
  )
}
