import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore } from '../store/useAppStore'

function deadlineColor(deadline: string): string {
  if (!deadline) return 'var(--muted-foreground)'
  const skip = ['상시', '채용시', '수시']
  if (skip.some((k) => deadline.includes(k))) return '#888'

  const m = deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return 'var(--muted-foreground)'
  const target = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  const days = Math.ceil((target.getTime() - Date.now()) / 86400000)
  if (days < 0) return '#555'
  if (days <= 3) return 'var(--color-error-foreground)'
  if (days <= 7) return 'var(--color-warning-foreground)'
  return 'var(--color-success-foreground)'
}

export function AllJobsPage() {
  const [search, setSearch] = useState('')
  const { sourceFilter } = useAppStore()
  const { data, isLoading } = useQuery({ queryKey: ['jobs-all'], queryFn: api.jobs.all })

  const jobs = (data?.jobs ?? []).filter(
    (j) =>
      (!sourceFilter || j.source === sourceFilter) &&
      (!search || j.title.includes(search) || j.company.includes(search))
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar search={search} onSearchChange={setSearch} showLegend={false} />

      <div className="flex-1 overflow-y-auto" style={{ padding: '0 24px' }}>
        {/* Column header */}
        <div
          className="flex items-center gap-4 text-[11px] font-semibold sticky top-0 z-10"
          style={{ height: 36, color: 'var(--muted-foreground)', background: 'var(--background)', padding: '0 4px', borderBottom: '1px solid var(--border)' }}
        >
          <span className="flex-1">공고명 / 회사명</span>
          <span style={{ width: 90, textAlign: 'center' }}>마감일</span>
          <span style={{ width: 88 }} />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            불러오는 중...
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.url}
            className="flex items-center gap-4"
            style={{ height: 56, padding: '0 4px', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                {job.title}
              </div>
              <div className="text-[12px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                {job.company}
              </div>
            </div>
            <div className="text-[13px] font-bold text-center shrink-0" style={{ width: 90, color: deadlineColor(job.deadline) }}>
              {job.deadline || '—'}
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 h-[28px] rounded-lg text-[12px] shrink-0"
              style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
            >
              <ExternalLink size={11} /> 공고 보기
            </a>
          </div>
        ))}

        {!isLoading && jobs.length === 0 && (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            공고가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
