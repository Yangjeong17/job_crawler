import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore } from '../store/useAppStore'

function deadlineDays(deadline_date: string, deadline?: string): number | null {
  const val = deadline_date || deadline || ''
  if (!val) return null
  const skip = ['상시', '채용시', '수시', '채용 시']
  if (skip.some((k) => val.includes(k))) return null

  const m = val.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) {
    const target = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    return Math.ceil((target.getTime() - Date.now()) / 86400000)
  }
  return null
}

function deadlineColor(deadline_date: string, deadline?: string): string {
  const val = deadline_date || deadline || ''
  if (!val) return 'var(--muted-foreground)'
  const skip = ['상시', '채용시', '수시', '채용 시']
  if (skip.some((k) => val.includes(k))) return 'var(--badge-gray-text)'

  const days = deadlineDays(deadline_date, deadline)
  if (days === null) return 'var(--muted-foreground)'
  if (days < 0)  return 'var(--badge-gray-text)'
  if (days <= 3) return 'var(--badge-red-text)'
  if (days <= 7) return 'var(--badge-yellow-text)'
  return 'var(--badge-green-text)'
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar search={search} onSearchChange={setSearch} showLegend={false} showTabNav />

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 24px' }}>
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
            <div className="text-[13px] font-bold text-center shrink-0" style={{ width: 90, color: deadlineColor(job.deadline_date, job.deadline) }}>
              {job.deadline_date || job.deadline || '—'}
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 28, borderRadius: 8, fontSize: 12, flexShrink: 0, background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', textDecoration: 'none' }}
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
