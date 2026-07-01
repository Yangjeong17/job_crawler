import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, History, FolderOpen, ChevronDown, Database, Search } from 'lucide-react'
import { createCrawlSocket } from '../../api/client'
import { useAppStore } from '../../store/useAppStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

export function Sidebar() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [useSaramin, setUseSaramin] = useState(true)
  const [useJobkorea, setUseJobkorea] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [selectedDb, setSelectedDb] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showDbSwitch, setShowDbSwitch] = useState(false)
  const [switchTarget, setSwitchTarget] = useState('')
  const [newDbName, setNewDbName] = useState('')
  const [dbCreateMode, setDbCreateMode] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [migrating, setMigrating] = useState(false)

  const { crawling, setCrawling, crawlLog, addCrawlLog, clearCrawlLog, sidebarOpen } = useAppStore()
  const qc = useQueryClient()

  const { data: stats }    = useQuery({ queryKey: ['stats'],      queryFn: api.stats,          refetchInterval: 10000 })
  const { data: savedData }= useQuery({ queryKey: ['jobs-saved'], queryFn: api.jobs.saved,     staleTime: 30000 })
  const { data: favData }  = useQuery({ queryKey: ['jobs-fav'],   queryFn: api.jobs.favorites, staleTime: 30000 })
  const { data: dbFiles }  = useQuery({ queryKey: ['db-files'],   queryFn: api.dbFiles })
  const { data: historyData } = useQuery({ queryKey: ['search-history'], queryFn: api.searchHistory, enabled: showHistory })
  const { data: currentDb, refetch: refetchCurrentDb } = useQuery({ queryKey: ['db-current'], queryFn: api.dbCurrent })

  async function handleDbSwitch() {
    const target = dbCreateMode ? newDbName.trim() : switchTarget
    if (!target || switching) return
    setSwitching(true)
    try {
      await api.dbSwitch(target)
      await refetchCurrentDb()
      qc.invalidateQueries()
      setShowDbSwitch(false)
      setSwitchTarget('')
      setNewDbName('')
    } finally {
      setSwitching(false)
    }
  }

  async function handleMigrate() {
    if (!selectedDb || migrating) return
    setMigrating(true)
    try {
      await api.migrate(selectedDb)
      qc.invalidateQueries()
    } finally {
      setMigrating(false)
    }
  }

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
        qc.invalidateQueries({ queryKey: ['jobs-screening'] })
      }
      if (msg.type === 'error') {
        addCrawlLog(`오류: ${msg.message}`)
        setCrawling(false)
      }
    })
  }

  return (
    <aside
      className="shrink-0 overflow-hidden"
      style={{
        width: sidebarOpen ? 220 : 0,
        background: 'var(--sidebar)',
        borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
        transition: 'width 0.2s ease',
      }}
    >
    <div className="flex flex-col overflow-y-auto" style={{ width: 220, height: '100%' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0" style={{ height: 64, padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--brand-primary)' }}>
          <span className="text-white font-bold text-xs">J</span>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-bold text-base leading-tight" style={{ color: 'var(--foreground)' }}>Career Pilot</span>
          <span className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
            {currentDb?.db_name ?? '…'}
          </span>
        </div>
      </div>

      {/* DB 전환 */}
      <div
        className="flex items-center gap-2 h-8 text-[11px] cursor-pointer shrink-0"
        style={{ padding: '0 16px', background: 'var(--secondary)', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        onClick={() => { setShowDbSwitch((v) => !v); setSwitchTarget('') }}
      >
        <Database size={11} />
        <span className="flex-1">DB 전환</span>
        <ChevronDown size={11} style={{ transform: showDbSwitch ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
      </div>

      {showDbSwitch && (
        <div className="flex flex-col gap-2 shrink-0" style={{ padding: '8px 16px 12px', background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
          {/* 탭 */}
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['기존 선택', '새로 만들기'] as const).map((label, i) => {
              const active = dbCreateMode === (i === 1)
              return (
                <button
                  key={label}
                  onClick={() => setDbCreateMode(i === 1)}
                  className="flex-1 text-[11px] font-medium"
                  style={{
                    height: 26, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--brand-primary)' : 'transparent',
                    color: active ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {dbCreateMode ? (
            <input
              className="w-full h-8 rounded text-xs"
              style={{ padding: '0 8px', background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)', outline: 'none' }}
              placeholder="새 DB 이름 (예: jobs_2.db)"
              value={newDbName}
              onChange={(e) => setNewDbName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDbSwitch()}
            />
          ) : (
            <select
              className="w-full h-8 rounded text-xs"
              style={{ padding: '0 8px', background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              value={switchTarget}
              onChange={(e) => setSwitchTarget(e.target.value)}
            >
              <option value="">DB 선택...</option>
              {dbFiles?.files.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}

          <button
            disabled={dbCreateMode ? !newDbName.trim() || switching : !switchTarget || switching}
            onClick={handleDbSwitch}
            className="w-full h-8 rounded text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--brand-primary)', color: '#fff' }}
          >
            {switching ? (dbCreateMode ? '생성 중...' : '전환 중...') : (dbCreateMode ? '생성 후 전환' : '전환')}
          </button>
        </div>
      )}

      {/* 키워드 검색 */}
      <div className="flex flex-col gap-2 shrink-0" style={{ padding: '12px 16px' }}>
        <label className="text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>키워드</label>
        <div className="flex items-center gap-2 rounded-md h-9 text-xs" style={{ padding: '0 12px', background: 'var(--secondary)', border: '1px solid var(--brand-primary)' }}>
          <Search size={14} style={{ color: 'var(--muted-foreground)' }} />
          <input
            className="flex-1 bg-transparent outline-none"
            style={{ color: 'var(--foreground)' }}
            placeholder="예: 백엔드 Python"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startCrawl()}
          />
        </div>
      </div>

      {/* 사이트 */}
      <div className="flex flex-col gap-1.5 shrink-0" style={{ padding: '8px 16px' }}>
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

      {/* 검색 버튼 */}
      <div className="shrink-0" style={{ padding: '10px 16px' }}>
        <button
          onClick={startCrawl}
          disabled={crawling || !keyword.trim()}
          className="w-full h-10 rounded-lg font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
          style={{ background: 'var(--brand-primary)', color: '#fff', fontSize: 14 }}
        >
          <Search size={14} className={crawling ? 'animate-pulse' : ''} />
          {crawling ? '검색 중...' : '검색'}
        </button>
      </div>

      {/* 크롤 로그 */}
      {crawlLog.length > 0 && (
        <div style={{ margin: '0 16px 8px', padding: 8, borderRadius: 6, fontSize: 10, lineHeight: 1.6, flexShrink: 0, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
          {crawlLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* 9px 스페이서 */}
      <div className="shrink-0" style={{ height: 9 }} />

      {/* 스케줄러 */}
      <div
        className="flex items-center gap-2 shrink-0 cursor-pointer"
        style={{ height: 45, padding: '0 16px', background: 'var(--brand-primary-bg-hover)', color: 'var(--foreground)', fontSize: 15 }}
        onClick={() => navigate('/scheduler')}
      >
        <Calendar size={14} style={{ color: 'var(--muted-foreground)' }} />
        스케줄러
      </div>

      {/* 현황 */}
      <div className="flex flex-col gap-2 shrink-0" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div className="text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>오늘의 현황</div>
        {([
          ['전체',    stats?.total            ?? '…'],
          ['저장',    savedData?.jobs.length   ?? '…'],
          ['즐겨찾기', favData?.jobs.length    ?? '…'],
        ] as [string, number | string][]).map(([label, val]) => (
          <div key={label} className="flex items-center justify-between text-xs" style={{ height: 24 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
            <span className="font-bold" style={{ color: 'var(--foreground)' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* 검색 기록 */}
      <div
        className="flex items-center gap-2 shrink-0 cursor-pointer"
        style={{ height: 40, padding: '0 16px', border: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none', color: 'var(--foreground)' }}
        onClick={() => setShowHistory((v) => !v)}
      >
        <ChevronDown size={12} style={{ color: 'var(--muted-foreground)', transform: showHistory ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
        <History size={12} style={{ color: 'var(--muted-foreground)' }} />
        <span className="text-xs">검색 기록</span>
      </div>

      {showHistory && (
        <div className="flex flex-col shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {(historyData?.history ?? []).length === 0 ? (
            <div className="text-[11px]" style={{ padding: '8px 16px', color: 'var(--muted-foreground)' }}>기록 없음</div>
          ) : (
            historyData?.history.map((h) => (
              <div
                key={h.keyword}
                className="flex items-center justify-between text-[11px] cursor-pointer"
                style={{ padding: '6px 16px', color: 'var(--foreground)' }}
                onClick={() => { setKeyword(h.keyword); setShowHistory(false) }}
              >
                <span className="truncate flex-1">{h.keyword}</span>
                <span style={{ flexShrink: 0, marginLeft: 8, color: 'var(--muted-foreground)' }}>{h.count}회</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 이전 DB 스와이프 가져오기 */}
      <div
        className="flex items-center gap-2 shrink-0 cursor-pointer"
        style={{ height: 40, padding: '0 16px', color: 'var(--foreground)' }}
        onClick={() => setShowImport((v) => !v)}
      >
        <ChevronDown size={12} style={{ color: 'var(--muted-foreground)', transform: showImport ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
        <FolderOpen size={12} style={{ color: 'var(--brand-primary)' }} />
        <span className="text-xs">이전 DB 스와이프 가져오기</span>
      </div>

      {showImport && (
        <div className="flex flex-col gap-2 shrink-0" style={{ padding: '8px 16px 12px', background: 'var(--import-db-bg)', borderBottom: '1px solid var(--border)' }}>
          <div
            className="flex items-center justify-between rounded-md h-[34px] text-xs"
            style={{ padding: '0 12px', background: 'var(--secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <select
              className="flex-1 outline-none"
              style={{ background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer', fontSize: 12 }}
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
            >
              <option value="">DB 선택...</option>
              {dbFiles?.files.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <button
            disabled={!selectedDb || migrating}
            onClick={handleMigrate}
            className="w-full rounded font-semibold disabled:opacity-50"
            style={{ height: 36, background: 'var(--foreground)', color: 'var(--background)', fontSize: 13 }}
          >
            {migrating ? '가져오는 중...' : '가져오기'}
          </button>
        </div>
      )}
    </div>
    </aside>
  )
}
