import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReassignTo } from '../types/job'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar } from '../components/layout/TopBar'
import { ListCard } from '../components/ui/ListCard'

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
  const qc = useQueryClient()
  const cfg = CONFIG[mode]
  const { sourceFilter } = useAppStore()

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

  return (
    <div className="flex flex-col h-full">
      <TopBar search={search} onSearchChange={setSearch} />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            불러오는 중...
          </div>
        )}

        {jobs.map((job) => (
          <ListCard
            key={job.url}
            job={job}
            onNotInterested={mode !== 'not-interested' ? () => reassign(job.url, 'ni') : undefined}
            onSave={mode !== 'saved' ? () => reassign(job.url, 'saved') : undefined}
            onFavorite={mode !== 'favorites' ? () => reassign(job.url, 'favorite') : undefined}
          />
        ))}

        {!isLoading && jobs.length === 0 && (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            항목이 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
