import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { ReassignTo } from '../types/job'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar, type SortBy } from '../components/layout/TopBar'
import { ListCard } from '../components/ui/ListCard'
import { AnalysisModal } from '../components/ui/AnalysisModal'

interface BatchResult {
  title: string
  company: string
  result: string
  url: string
}

function parseDeadlineDays(deadline?: string): number | null {
  if (!deadline) return null
  let m = deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) {
    const target = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    return Math.ceil((target.getTime() - Date.now()) / 86400000)
  }
  m = deadline.match(/^(\d{1,2})[/.](\d{1,2})$/)
  if (m) {
    const now = new Date()
    const target = new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]))
    if (target.getTime() < now.getTime()) target.setFullYear(now.getFullYear() + 1)
    return Math.ceil((target.getTime() - now.getTime()) / 86400000)
  }
  return null
}

type Mode = 'not-interested' | 'saved' | 'favorites'

const CONFIG: Record<Mode, {
  queryKey: string
  fetcher: () => Promise<{ jobs: any[] }>
  reassignFrom: 'ni' | 'saved' | 'favorite'
}> = {
  'not-interested': { queryKey: 'jobs-ni',  fetcher: api.jobs.notInterested, reassignFrom: 'ni' },
  'saved':          { queryKey: 'jobs-saved', fetcher: api.jobs.saved,  reassignFrom: 'saved' },
  'favorites':      { queryKey: 'jobs-fav',  fetcher: api.jobs.favorites, reassignFrom: 'favorite' },
}

interface Props { mode: Mode }

export function JobListPage({ mode }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortBy>('recent')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analyzeAllLoading, setAnalyzeAllLoading] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null)
  const qc = useQueryClient()
  const cfg = CONFIG[mode]
  const { sourceFilter, showToast } = useAppStore()

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

  function closeAnalysis() {
    setAnalysisResult(null)
    setAnalysisError(null)
    setAnalysisLoading(false)
  }

  const { data, isLoading } = useQuery({
    queryKey: [cfg.queryKey],
    queryFn: cfg.fetcher,
  })

  const filtered = (data?.jobs ?? []).filter(
    (j) =>
      (!sourceFilter || j.source === sourceFilter) &&
      (!search || j.title.includes(search) || j.company.includes(search))
  )

  const jobs = (() => {
    if (sort === 'ongoing') return filtered.filter((j) => !j.deadline || j.deadline === '')
    if (sort === 'deadline') return [...filtered].sort((a, b) => {
      const da = parseDeadlineDays(a.deadline)
      const db = parseDeadlineDays(b.deadline)
      if (da === null && db === null) return 0
      if (da === null) return 1
      if (db === null) return -1
      return da - db
    })
    return filtered
  })()

  async function reassign(url: string, to: ReassignTo) {
    await api.jobs.reassign(url, cfg.reassignFrom, to)
    qc.invalidateQueries({ queryKey: [cfg.queryKey] })
  }

  async function analyzeAll() {
    if (analyzeAllLoading || jobs.length === 0) return
    setAnalyzeAllLoading(true)
    setBatchResults(null)
    const results: BatchResult[] = []
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      showToast(`AI 분석 중... (${i + 1}/${jobs.length}) ${job.company}`)
      try {
        const { result } = await api.analyze(job.url)
        results.push({ title: job.title, company: job.company, result, url: job.url })
      } catch {
        results.push({ title: job.title, company: job.company, result: '분석 실패', url: job.url })
      }
    }
    setAnalyzeAllLoading(false)
    setBatchResults(results)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        onAnalyzeAll={mode === 'favorites' ? analyzeAll : undefined}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', minHeight: 0 }}>
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 14, color: 'var(--muted-foreground)' }}>
            불러오는 중...
          </div>
        )}

        {jobs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.map((job) => (
              <ListCard
                key={job.url}
                job={job}
                onNotInterested={mode !== 'not-interested' ? () => reassign(job.url, 'ni') : undefined}
                onSave={mode !== 'saved' ? () => reassign(job.url, 'saved') : undefined}
                onFavorite={mode !== 'favorites' ? () => reassign(job.url, 'favorite') : undefined}
                onAnalyze={() => openAnalysis(job.url)}
              />
            ))}
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 14, color: 'var(--muted-foreground)' }}>
            항목이 없습니다.
          </div>
        )}
      </div>

      {(analysisLoading || analysisResult !== null || analysisError !== null) && (
        <AnalysisModal
          loading={analysisLoading}
          result={analysisResult}
          error={analysisError}
          onClose={closeAnalysis}
        />
      )}

      {batchResults && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => e.target === e.currentTarget && setBatchResults(null)}
        >
          <div style={{ width: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--sidebar)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>
                AI 전체분석 결과 ({batchResults.length}건)
              </span>
              <button
                onClick={() => setBatchResults(null)}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <X size={13} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {batchResults.map((r) => (
                <div key={r.url} style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 10 }}>{r.company}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{r.result}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
