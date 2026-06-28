import { useState } from 'react'
import { RefreshCw, Calendar, History, FolderOpen, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { createCrawlSocket } from '../../api/client'
import { useAppStore } from '../../store/useAppStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

export function Sidebar() {
  const [keyword, setKeyword] = useState('')
  const [useSaramin, setUseSaramin] = useState(true)
  const [useJobkorea, setUseJobkorea] = useState(true)
  const [crawling, setCrawling] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedDb, setSelectedDb] = useState('')

  const { crawlLog, addCrawlLog, clearCrawlLog } = useAppStore()

  const { data: stats }   = useQuery({ queryKey: ['stats'],    queryFn: api.stats,            refetchInterval: 10000 })
  const { data: niData }  = useQuery({ queryKey: ['jobs-ni'],   queryFn: api.jobs.notInterested, staleTime: 30000 })
  const { data: savedData}= useQuery({ queryKey: ['jobs-saved'],queryFn: api.jobs.saved,          staleTime: 30000 })
  const { data: favData } = useQuery({ queryKey: ['jobs-fav'],  queryFn: api.jobs.favorites,      staleTime: 30000 })
  const { data: dbFiles } = useQuery({ queryKey: ['db-files'],  queryFn: api.dbFiles })

  function startCrawl() {
    if (!keyword.trim() || crawling) return
    clearCrawlLog()
    setCrawling(true)
    const ws = createCrawlSocket(keyword, useSaramin, useJobkorea, (msg) => {
      if (msg.type === 'progress') addCrawlLog(msg.message)
      if (msg.type === 'done') {
        addCrawlLog(`완료: ${msg.total}개 수집, ${msg.filtered}개 표시`)
        setCrawling(false)
        ws.close()
      }
      if (msg.type === 'error') {
        addCrawlLog(`오류: ${msg.message}`)
        setCrawling(false)
      }
    })
  }

  return (
    <aside
      className="flex flex-col shrink-0 overflow-y-auto"
      style={{ width: 220, background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-primary)' }}>
          <span className="text-white font-bold text-xs">J</span>
        </div>
        <span className="font-bold text-base" style={{ color: 'var(--foreground)' }}>JobHub</span>
      </div>

      {/* Keyword */}
      <div className="flex flex-col gap-2 p-3">
        <label className="text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>키워드</label>
        <div className="flex items-center gap-2 rounded-md px-3 h-9 text-xs" style={{ background: 'var(--secondary)', border: '1px solid var(--brand-primary)' }}>
          <Search size={12} style={{ color: 'var(--brand-primary)' }} />
          <input
            className="flex-1 bg-transparent outline-none"
            style={{ color: 'var(--foreground)' }}
            placeholder="예: 백엔드 개발자"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startCrawl()}
          />
        </div>
      </div>

      {/* Sites */}
      <div className="flex flex-col gap-2 px-3 pb-3">
        <label className="text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>사이트</label>
        <div className="flex gap-4">
          {[['saramin', '사람인', useSaramin, setUseSaramin], ['jobkorea', '잡코리아', useJobkorea, setUseJobkorea]].map(
            ([id, label, checked, setter]) => (
              <label key={id as string} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={checked as boolean}
                  onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                  className="accent-[var(--brand-primary)]"
                />
                {label as string}
              </label>
            )
          )}
        </div>
      </div>

      {/* Crawl button */}
      <div className="px-3 pb-2">
        <button
          onClick={startCrawl}
          disabled={crawling || !keyword.trim()}
          className="w-full h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
          style={{ background: 'var(--brand-primary)', color: '#fff' }}
        >
          <RefreshCw size={12} className={crawling ? 'animate-spin' : ''} />
          {crawling ? '크롤링 중...' : '크롤링 시작'}
        </button>
      </div>

      {/* Crawl log */}
      {crawlLog.length > 0 && (
        <div className="mx-3 mb-2 p-2 rounded text-[10px] leading-relaxed" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
          {crawlLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* Scheduler shortcut */}
      <div className="flex items-center gap-2 px-4 h-11 text-sm cursor-pointer" style={{ background: 'var(--brand-primary-bg-hover)', color: 'var(--foreground)' }}>
        <Calendar size={14} style={{ color: 'var(--muted-foreground)' }} />
        스케줄러
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-1.5 p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--muted-foreground)' }}>현황</div>
        {([
          ['전체',    stats?.total           ?? '…', 'var(--brand-primary)'],
          ['저장',    savedData?.jobs.length  ?? '…', 'var(--color-info-foreground)'],
          ['즐겨찾기', favData?.jobs.length   ?? '…', 'var(--color-warning-foreground)'],
          ['관심없음', niData?.jobs.length    ?? '…', 'var(--muted-foreground)'],
        ] as const).map(([label, val, color]) => (
          <div key={label} className="flex items-center justify-between h-6 text-xs">
            <span style={{ color: 'var(--foreground)' }}>{label}</span>
            <span className="font-semibold" style={{ color }}>{val}</span>
          </div>
        ))}
      </div>

      {/* History */}
      <div
        className="flex items-center gap-2 px-4 h-9 text-xs cursor-pointer"
        style={{ border: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none', color: 'var(--foreground)' }}
      >
        <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
        <History size={12} style={{ color: 'var(--muted-foreground)' }} />
        검색 기록
      </div>

      {/* Import DB */}
      <div
        className="flex items-center gap-2 px-4 h-9 text-xs cursor-pointer"
        style={{ color: 'var(--foreground)' }}
        onClick={() => setShowImport((v) => !v)}
      >
        <ChevronDown size={12} style={{ color: 'var(--muted-foreground)', transform: showImport ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
        <FolderOpen size={12} style={{ color: 'var(--brand-primary)' }} />
        이전 DB 스와이프 가져오기
      </div>

      {showImport && (
        <div className="flex flex-col gap-2 px-3 pb-3 pt-1" style={{ background: 'var(--import-db-bg)', borderBottom: '1px solid var(--border)' }}>
          <select
            className="w-full h-8 rounded px-2 text-xs"
            style={{ background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
          >
            <option value="">DB 선택...</option>
            {dbFiles?.files.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button
            disabled={!selectedDb}
            onClick={() => selectedDb && api.migrate(selectedDb)}
            className="w-full h-8 rounded text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--foreground)', color: 'var(--background)' }}
          >
            가져오기
          </button>
        </div>
      )}
    </aside>
  )
}
