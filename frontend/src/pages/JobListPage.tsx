import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReassignTo } from '../types/job'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar } from '../components/layout/TopBar'
import { ListCard } from '../components/ui/ListCard'
import { AnalysisModal } from '../components/ui/AnalysisModal'

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
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analyzeAllLoading, setAnalyzeAllLoading] = useState(false)
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

  const jobs = (data?.jobs ?? []).filter(
    (j) =>
      (!sourceFilter || j.source === sourceFilter) &&
      (!search || j.title.includes(search) || j.company.includes(search))
  )

  async function reassign(url: string, to: ReassignTo) {
    await api.jobs.reassign(url, cfg.reassignFrom, to)
    qc.invalidateQueries({ queryKey: [cfg.queryKey] })
  }

  async function analyzeAll() {
    if (analyzeAllLoading || jobs.length === 0) return
    setAnalyzeAllLoading(true)
    showToast(`${jobs.length}개 공고 분석 준비 중...`)
    setAnalyzeAllLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar
        search={search}
        onSearchChange={setSearch}
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
    </div>
  )
}
