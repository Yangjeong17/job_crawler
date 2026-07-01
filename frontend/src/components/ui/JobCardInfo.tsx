import { DollarSign } from 'lucide-react'
import type { Job } from '../../types/job'
import { DeadlineMiniBadge } from './DBadge'

interface Props {
  job: Job
  detailed?: boolean
}

function TagList({ items, color }: { items: string[]; color: 'category' | 'tech' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((v) => (
        <span
          key={v}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 4,
            background: color === 'category' ? 'var(--secondary)' : 'var(--brand-primary-subtle)',
            color: color === 'category' ? 'var(--muted-foreground)' : 'var(--color-info-foreground)',
          }}
        >
          {v}
        </span>
      ))}
    </div>
  )
}

export function JobCardInfo({ job, detailed = false }: Props) {
  const categories = job.categories?.filter((c) => c !== '헤드헌터') ?? []
  const techStack = job.tech_stack ?? []

  return (
    <>
      {/* 1: 출처, (아이콘 자리 확보 — 데이터 없음), 마감일 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
          {{ saramin: '사람인', jobkorea: '잡코리아' }[job.source] ?? job.source}
        </span>
        <span style={{ width: 16, height: 16, flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
          {(job.deadline_date || job.deadline) && (
            <DeadlineMiniBadge
              deadline_date={job.deadline_date}
              deadline={job.deadline}
              fallback={
                <span
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontWeight: 600,
                    color: 'var(--muted-foreground)',
                    border: '0.5px solid var(--border)',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                  }}
                >
                  마감일: {job.deadline_date || job.deadline}
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* 2: 제목 — 줄바꿈 허용 */}
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: 'var(--foreground)', marginBottom: 6 }}>
        {job.title}
      </div>

      {/* 3: 회사명, 고용형태 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-primary)' }}>{job.company}</span>
        {job.job_type && <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{job.job_type}</span>}
      </div>

      {/* 4: 지역, 경력, 학력 */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap', color: 'var(--muted-foreground)', marginBottom: 12 }}>
        {job.location && <span>{job.location}</span>}
        {job.experience && <span>{job.experience}</span>}
        {job.education && <span>{job.education}</span>}
      </div>

      {(categories.length > 0 || techStack.length > 0) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {detailed ? (
            <>
              {categories.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>카테고리</div>
                  <TagList items={categories} color="category" />
                </div>
              )}
              {techStack.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>기술 스택</div>
                  <TagList items={techStack} color="tech" />
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <TagList items={categories} color="category" />
              <TagList items={techStack} color="tech" />
            </div>
          )}
        </div>
      )}

      {detailed && (job.description || job.salary) && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {job.description && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>채용 내용</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{job.description}</div>
            </div>
          )}
          {job.salary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)' }}>
              <DollarSign size={14} style={{ flexShrink: 0 }} />
              {job.salary}
            </div>
          )}
        </div>
      )}
    </>
  )
}
