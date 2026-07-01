import { ExternalLink, Heart, ThumbsDown, Bookmark, Sparkles } from 'lucide-react'
import type { Job } from '../../types/job'
import { DBadge } from './DBadge'
import { useViewportWidth } from '../../hooks/useViewportWidth'

const COMPACT_BREAKPOINT = 1020
const MINI_BREAKPOINT = 600

interface Props {
  job: Job
  onNotInterested?: () => void
  onSave?: () => void
  onFavorite?: () => void
  onAnalyze?: () => void
}

// 표시 전용: "YYYY-MM-DD" 등을 "MM/DD"로 축약
function formatDeadlineDisplay(deadline_date?: string, deadline?: string): string {
  const val = deadline_date || deadline || ''
  const m = val.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) return `${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`
  return val
}

export function ListCard({ job, onNotInterested, onSave, onFavorite, onAnalyze }: Props) {
  const viewportWidth = useViewportWidth()
  const isCompact = viewportWidth <= COMPACT_BREAKPOINT
  const isMini = viewportWidth <= MINI_BREAKPOINT

  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        minHeight: 100,
      }}
    >
      <DBadge deadline_date={job.deadline_date} deadline={job.deadline} />

      {/* 공고 정보 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, padding: '12px 12px', minWidth: 0 }}>
        {/* 1줄: 출처, (아이콘 자리 확보 — 데이터 없음), 마감일 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500, background: 'var(--color-info)', color: 'var(--color-info-foreground)' }}>
            {{ saramin: '사람인', jobkorea: '잡코리아' }[job.source] ?? job.source}
          </span>
          <span style={{ width: 14, height: 14, flexShrink: 0 }} />
          {(job.deadline_date || job.deadline) && (
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {formatDeadlineDisplay(job.deadline_date, job.deadline)}
            </span>
          )}
        </div>

        {/* 2줄: 제목 */}
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.title}
        </div>

        {/* 3줄: 회사명, 지역, 고용형태, 직무분야 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{job.company}</span>
          {job.location && <span style={{ color: 'var(--muted-foreground)' }}>{job.location}</span>}
          {job.job_type && <span style={{ color: 'var(--muted-foreground)' }}>{job.job_type}</span>}
          {job.categories?.map((c) => (
            <span key={c} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
              {c}
            </span>
          ))}
        </div>

        {/* 4줄: 경력, 학력, 기술스택 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap', color: 'var(--muted-foreground)' }}>
          {job.experience && <span>{job.experience}</span>}
          {job.education && <span>{job.education}</span>}
          {job.tech_stack?.map((t) => (
            <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--brand-primary-subtle)', color: 'var(--color-info-foreground)' }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 액션 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 15, padding: '10px 16px', flexShrink: 0 }}>
        {/* 버튼 1줄: 관심없음 → 저장 → 즐겨찾기 → 공고보기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onNotInterested && !isMini && (
            <button onClick={onNotInterested} aria-label="관심없음" className="btn-sm btn-error" style={isCompact ? { width: 'auto', padding: '8px 10px' } : undefined}>
              <ThumbsDown size={12} style={{ flexShrink: 0 }} /> {!isCompact && '관심없음'}
            </button>
          )}
          {onSave && !isMini && (
            <button onClick={onSave} aria-label="저장" className="btn-sm btn-warning" style={isCompact ? { width: 'auto', padding: '8px 10px' } : undefined}>
              <Bookmark size={12} style={{ flexShrink: 0 }} /> {!isCompact && '저장'}
            </button>
          )}
          {onFavorite && !isMini && (
            <button onClick={onFavorite} aria-label="즐겨찾기" className="btn-sm btn-success" style={isCompact ? { width: 'auto', padding: '8px 10px' } : undefined}>
              <Heart size={12} style={{ flexShrink: 0 }} /> {!isCompact && '즐겨찾기'}
            </button>
          )}
          <a href={job.url} target="_blank" rel="noreferrer" aria-label="공고보기" className="btn-sm btn-secondary" style={isCompact ? { width: 'auto', padding: '8px 10px' } : undefined}>
            <ExternalLink size={12} style={{ flexShrink: 0 }} /> {!isCompact && '공고보기'}
          </a>
        </div>

        {/* 상세분석 — 별도 줄 */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            aria-label="상세분석"
            className="btn-sm btn-info"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Sparkles size={12} style={{ flexShrink: 0 }} /> {!isMini && '상세분석'}
          </button>
        )}
      </div>
    </div>
  )
}
