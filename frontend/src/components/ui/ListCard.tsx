import { ExternalLink, Heart, ThumbsDown, Bookmark, Sparkles } from 'lucide-react'
import type { Job } from '../../types/job'
import { DBadge } from './DBadge'

interface Props {
  job: Job
  onNotInterested?: () => void
  onSave?: () => void
  onFavorite?: () => void
  onAnalyze?: () => void
}

export function ListCard({ job, onNotInterested, onSave, onFavorite, onAnalyze }: Props) {
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <DBadge deadline={job.deadline} />

      <div className="flex flex-col gap-1 flex-1 p-3">
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
              <Sparkles size={11} /> AI분석
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
