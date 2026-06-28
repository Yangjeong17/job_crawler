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

function parseDaysLeft(deadline: string): number | null {
  const m = deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  const target = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}

function deadlineBadgeStyle(days: number | null) {
  if (days === null) return { bg: 'var(--secondary)', fg: '#888' }
  if (days < 0)  return { bg: 'var(--secondary)', fg: '#555' }
  if (days <= 3) return { bg: 'var(--color-error)',   fg: 'var(--color-error-foreground)' }
  if (days <= 7) return { bg: 'var(--color-warning)', fg: 'var(--color-warning-foreground)' }
  return { bg: 'var(--color-success)', fg: 'var(--color-success-foreground)' }
}

export function SchedulerPage() {
  const [view, setView] = useState<View>('list')
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

  const jobsWithDeadline = jobs.filter((j) => j.deadline && parseDaysLeft(j.deadline) !== null)
  const deadlineMap: Record<string, typeof jobs> = {}
  for (const j of jobsWithDeadline) {
    const m = j.deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
    if (!m) continue
    const key = `${parseInt(m[1])}-${parseInt(m[2]) - 1}-${parseInt(m[3])}`
    if (!deadlineMap[key]) deadlineMap[key] = []
    deadlineMap[key].push(j)
  }

  const grid = getMonthGrid(year, month)

  return (
    <div className="flex flex-col h-full">
      {/* Sched top bar */}
      <div className="flex items-center gap-4 px-6 shrink-0" style={{ height: 48, background: 'var(--neutral-action)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['list', 'calendar'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-5 h-8 text-xs font-medium transition-colors"
              style={{
                background: view === v ? 'var(--color-info)' : 'transparent',
                color: view === v ? 'var(--color-info-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {v === 'list' ? '리스트' : '캘린더'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-lg px-3 h-8" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>공고명·회사명 검색</span>
        </div>
      </div>

      {view === 'list' ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
          {jobs.length === 0 && (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              저장된 공고가 없습니다.
            </div>
          )}
          {[...jobs]
            .sort((a, b) => (parseDaysLeft(a.deadline) ?? 999) - (parseDaysLeft(b.deadline) ?? 999))
            .map((job) => (
              <ListCard
                key={job.url}
                job={job}
                onFavorite={() => reassign(job.url)}
                onAnalyze={() => openAnalysis(job.url)}
              />
            ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center px-6 shrink-0" style={{ height: 64, borderBottom: '1px solid var(--border)' }}>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>오늘</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--brand-primary)' }}>
                  {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
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
                      className="flex flex-col p-2 gap-1 overflow-hidden"
                      style={{
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
                        const days = parseDaysLeft(j.deadline)
                        const { bg, fg } = deadlineBadgeStyle(days)
                        return (
                          <div key={j.url} className="flex items-center gap-1 rounded px-1.5 text-[10px] font-medium overflow-hidden" style={{ height: 20, background: bg, color: fg, flexShrink: 0 }}>
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
