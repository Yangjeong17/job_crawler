import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../api/client'
import { ListCard } from '../components/ui/ListCard'
import { AnalysisModal } from '../components/ui/AnalysisModal'

type View = 'list' | 'calendar'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1).getDay()
  const last = new Date(year, month + 1, 0).getDate()
  const weeks: (number | null)[][] = []
  let day = 1
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = []
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < first) { week.push(null); continue }
      if (day > last) { week.push(null); continue }
      week.push(day++)
    }
    weeks.push(week)
    if (day > last) break
  }
  return weeks
}

function parseDaysLeft(deadline_date?: string, deadline?: string): number | null {
  const val = deadline_date || deadline
  if (!val) return null
  const m = val.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  const target = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}

function deadlineBadgeStyle(days: number | null) {
  if (days === null) return { bg: 'var(--secondary)', fg: 'var(--badge-gray-text)' }
  if (days < 0)  return { bg: 'var(--secondary)', fg: 'var(--muted-foreground)' }
  if (days <= 3) return { bg: 'var(--color-error)',   fg: 'var(--color-error-foreground)' }
  if (days <= 7) return { bg: 'var(--color-warning)', fg: 'var(--color-warning-foreground)' }
  return { bg: 'var(--color-success)', fg: 'var(--color-success-foreground)' }
}

export function SchedulerPage() {
  const [view, setView] = useState<View>('calendar')
  const [search, setSearch] = useState('')
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data } = useQuery({ queryKey: ['jobs-saved'], queryFn: api.jobs.saved })
  const jobs = data?.jobs ?? []

  async function openAnalysis(url: string) {
    setAnalysisResult(null)
    setAnalysisError(null)
    setAnalysisLoading(true)
    try {
      const { result } = await api.analyze(url)
      setAnalysisResult(result)
    } catch (e: any) {
      setAnalysisError(e.message ?? '분석 실패')
    } finally {
      setAnalysisLoading(false)
    }
  }

  async function reassign(url: string) {
    await api.jobs.reassign(url, 'saved', 'favorite')
    qc.invalidateQueries({ queryKey: ['jobs-saved'] })
  }

  const filteredJobs = search.trim()
    ? jobs.filter((j) => j.title.includes(search) || j.company.includes(search))
    : jobs
  const jobsWithDeadline = filteredJobs.filter((j) => parseDaysLeft(j.deadline_date, j.deadline) !== null)
  const deadlineMap: Record<string, typeof jobs> = {}
  for (const j of jobsWithDeadline) {
    const val = j.deadline_date || j.deadline
    if (!val) continue
    const m = val.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
    if (!m) continue
    const key = `${parseInt(m[1])}-${parseInt(m[2]) - 1}-${parseInt(m[3])}`
    if (!deadlineMap[key]) deadlineMap[key] = []
    deadlineMap[key].push(j)
  }

  const grid = getMonthGrid(year, month)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sched top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, height: 48, padding: '0 24px', background: 'var(--neutral-action)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['calendar', 'list'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '0 20px', height: 32, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'background 0.15s',
                background: view === v ? 'var(--color-info)' : 'transparent',
                color: view === v ? 'var(--color-info-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {v === 'list' ? '리스트' : '스케줄러'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '0 12px', height: 32, background: 'var(--secondary)', border: '1px solid var(--border)' }}>
          <input
            className="bg-transparent outline-none text-xs"
            style={{ color: 'var(--foreground)', width: 180 }}
            placeholder="공고명·회사명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {view === 'list' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', minHeight: 0 }}>
          {filteredJobs.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 14, color: 'var(--muted-foreground)' }}>
              {search.trim() ? '검색 결과가 없습니다.' : '저장된 공고가 없습니다.'}
            </div>
          )}
          {filteredJobs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...filteredJobs]
                .sort((a, b) => (parseDaysLeft(a.deadline_date, a.deadline) ?? 999) - (parseDaysLeft(b.deadline_date, b.deadline) ?? 999))
                .map((job) => (
                  <ListCard
                    key={job.url}
                    job={job}
                    onFavorite={() => reassign(job.url)}
                    onAnalyze={() => openAnalysis(job.url)}
                  />
                ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {/* Calendar header */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: 64, padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>오늘</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--brand-primary)' }}>
                  {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--brand-primary)', color: '#fff' }}>
                  {DAYS[today.getDay()]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                <ChevronLeft size={13} style={{ color: 'var(--muted-foreground)' }} />
              </button>
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{year}년 {month + 1}월</span>
              <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                <ChevronRight size={13} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid shrink-0" style={{ gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
            {DAYS.map((d, i) => (
              <div key={d} className="flex items-center justify-center h-9 text-xs font-semibold" style={{ color: i === 0 ? 'var(--color-error-foreground)' : 'var(--muted-foreground)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${grid.length}, 1fr)`, background: 'var(--border)', gap: 1, padding: 1 }}>
            {grid.map((week, wi) => (
              <div key={wi} className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {week.map((day, di) => {
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                  const isPast = day !== null && new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                  const key = `${year}-${month}-${day}`
                  const events = day !== null ? (deadlineMap[key] ?? []) : []

                  return (
                    <div
                      key={di}
                      className="flex flex-col gap-1 overflow-hidden"
                      style={{
                        padding: 8,
                        background: isToday ? 'var(--brand-primary-bg-hover)' : day === null ? 'var(--secondary)' : 'var(--background)',
                        minHeight: 0,
                      }}
                    >
                      {day !== null && (
                        isToday ? (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                            {day}
                          </div>
                        ) : (
                          <span className="text-xs font-medium shrink-0" style={{ color: di === 0 ? 'var(--color-error-foreground)' : isPast ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                            {day}
                          </span>
                        )
                      )}
                      {events.map((j) => {
                        const days = parseDaysLeft(j.deadline_date, j.deadline)
                        const { bg, fg } = deadlineBadgeStyle(days)
                        return (
                          <div key={j.url} style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4, padding: '0 6px', fontSize: 10, fontWeight: 500, overflow: 'hidden', height: 20, background: bg, color: fg, flexShrink: 0 }}>
                            <span className="truncate flex-1">{j.company}</span>
                            <span className="font-bold shrink-0">{days !== null && days >= 0 ? `D-${days}` : '마감'}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {(analysisLoading || analysisResult !== null || analysisError !== null) && (
        <AnalysisModal
          loading={analysisLoading}
          result={analysisResult}
          error={analysisError}
          onClose={() => { setAnalysisResult(null); setAnalysisError(null); setAnalysisLoading(false) }}
        />
      )}
    </div>
  )
}
