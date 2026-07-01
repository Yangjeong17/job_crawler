import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, ThumbsDown, Bookmark, Heart, ExternalLink, Undo2 } from 'lucide-react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import type { Job, ReassignTo, SwipeAction } from '../types/job'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar, type SortBy } from '../components/layout/TopBar'
import { ListCard } from '../components/ui/ListCard'
import { AnalysisModal } from '../components/ui/AnalysisModal'
import { useShortcuts } from '../hooks/useShortcuts'
import { DeadlineMiniBadge } from '../components/ui/DBadge'

interface BatchResult {
  title: string
  company: string
  result: string
  url: string
}

interface ReassignHistoryEntry {
  card: Job
  apiCalled: boolean
  to: ReassignTo | null
}

function parseDeadlineDays(deadline_date?: string, deadline?: string): number | null {
  const val = deadline_date || deadline
  if (!val) return null
  const m = val.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) {
    const target = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    return Math.ceil((target.getTime() - Date.now()) / 86400000)
  }
  return null
}

type Mode = 'not-interested' | 'saved' | 'favorites'

const CONFIG: Record<Mode, {
  queryKey: string
  fetcher: () => Promise<{ jobs: any[] }>
  reassignFrom: 'ni' | 'saved' | 'favorite'
}> = {
  'not-interested': { queryKey: 'jobs-ni',   fetcher: api.jobs.notInterested, reassignFrom: 'ni' },
  'saved':          { queryKey: 'jobs-saved', fetcher: api.jobs.saved,         reassignFrom: 'saved' },
  'favorites':      { queryKey: 'jobs-fav',  fetcher: api.jobs.favorites,     reassignFrom: 'favorite' },
}

// SwipeAction → ReassignTo 매핑
const SWIPE_TO_STATUS: Record<SwipeAction, ReassignTo> = {
  not_interested: 'ni',
  save: 'saved',
  favorite: 'favorite',
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

  // 재분류 모드 상태
  const [reassignMode, setReassignMode] = useState(false)
  const [reassignQueue, setReassignQueue] = useState<Job[]>([])
  const [reassignIndex, setReassignIndex] = useState(0)
  const [reassignExiting, setReassignExiting] = useState(false)
  const [reassignHistory, setReassignHistory] = useState<ReassignHistoryEntry[]>([])

  // 재분류 모드용 motion values (hook 규칙상 최상단에서 선언)
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const rOpacity = useMotionValue(1)
  const rRotate = useTransform(rx, [-300, 300], [-15, 15])
  const rNiOpacity = useTransform(rx, [-50, -150], [0, 1])
  const rSaveOpacity = useTransform(rx, [50, 150], [0, 1])
  const rFavOpacity = useTransform(ry, [-50, -150], [0, 1])

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
    if (sort === 'ongoing') return filtered.filter((j) => !j.deadline_date && !j.deadline)
    if (sort === 'deadline') return [...filtered].sort((a, b) => {
      const da = parseDeadlineDays(a.deadline_date, a.deadline)
      const db = parseDeadlineDays(b.deadline_date, b.deadline)
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

  // 재분류 모드 진입
  function startReassign() {
    setReassignQueue([...jobs] as Job[])
    setReassignIndex(0)
    rx.set(0)
    ry.set(0)
    rOpacity.set(1)
    setReassignExiting(false)
    setReassignMode(true)
  }

  // 재분류 모드 종료 (X 버튼 / 완료 후)
  function exitReassign() {
    setReassignMode(false)
    setReassignQueue([])
    setReassignIndex(0)
    setReassignHistory([])
    setReassignExiting(false)
    qc.invalidateQueries({ queryKey: [cfg.queryKey] })
  }

  // 재분류 스와이프 처리
  async function doReassign(action: SwipeAction) {
    const card = reassignQueue[reassignIndex]
    if (!card || reassignExiting) return
    setReassignExiting(true)

    // Phase 1: 오버레이 색상 표시
    const show = {
      not_interested: { x: -130, y: 0 },
      save:           { x: 130,  y: 0 },
      favorite:       { x: 0,    y: -130 },
    }[action]
    await Promise.all([
      animate(rx, show.x, { duration: 0.2, ease: 'easeOut' }),
      animate(ry, show.y, { duration: 0.2, ease: 'easeOut' }),
    ])

    // Phase 2: 카드 날아가기
    const flyOff = {
      not_interested: { x: -700, y: 80 },
      save:           { x: 700,  y: 80 },
      favorite:       { x: 0,    y: -700 },
    }[action]
    await Promise.all([
      animate(rx, flyOff.x, { duration: 0.3, ease: 'easeIn' }),
      animate(ry, flyOff.y, { duration: 0.3, ease: 'easeIn' }),
      animate(rOpacity, 0, { duration: 0.25, delay: 0.08 }),
    ])

    // 같은 분류면 API 호출 없이 다음 카드로, 다른 분류면 reassign API
    const toStatus = SWIPE_TO_STATUS[action]
    const apiCalled = toStatus !== cfg.reassignFrom
    if (apiCalled) {
      await api.jobs.reassign(card.url, cfg.reassignFrom, toStatus)
    }

    setReassignHistory((h) => [...h, { card, apiCalled, to: apiCalled ? toStatus : null }])
    setReassignIndex((i) => i + 1)
    rx.set(0)
    ry.set(0)
    await new Promise((r) => setTimeout(r, 16))
    await animate(rOpacity, 1, { duration: 0.18 })
    setReassignExiting(false)
  }

  async function undoReassign() {
    if (reassignHistory.length === 0 || reassignExiting) return
    const last = reassignHistory[reassignHistory.length - 1]

    if (last.apiCalled && last.to) {
      try {
        await api.jobs.reassign(last.card.url, last.to, cfg.reassignFrom)
      } catch {
        return
      }
    }

    setReassignIndex((i) => i - 1)
    setReassignHistory((h) => h.slice(0, -1))
  }

  function handleReassignDragEnd(_: any, info: PanInfo) {
    const { offset, velocity } = info
    if      (offset.x < -100 || velocity.x < -500) doReassign('not_interested')
    else if (offset.x >  100 || velocity.x >  500) doReassign('save')
    else if (offset.y < -100 || velocity.y < -500) doReassign('favorite')
    else {
      animate(rx, 0, { type: 'spring', stiffness: 300, damping: 30 })
      animate(ry, 0, { type: 'spring', stiffness: 300, damping: 30 })
    }
  }

  // 탭(mode) 변경 시 재분류 모드 자동 종료
  useEffect(() => {
    setReassignMode(false)
    setReassignQueue([])
    setReassignIndex(0)
    setReassignHistory([])
    setReassignExiting(false)
    rx.set(0)
    ry.set(0)
    rOpacity.set(1)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 재분류 모드 단축키 (기존 5개 단축키 그대로)
  const _reassignCard = reassignMode ? reassignQueue[reassignIndex] : undefined
  useShortcuts({
    onNotInterested: () => doReassign('not_interested'),
    onSave:          () => doReassign('save'),
    onFavorite:      () => doReassign('favorite'),
    onUndo:          undoReassign,
    onOpenUrl:       () => _reassignCard && window.open(_reassignCard.url, '_blank'),
  }, reassignMode && !!_reassignCard && !reassignExiting)

  // ─── 재분류 모드 UI ──────────────────────────────────────────────
  if (reassignMode) {
    const rCard = reassignQueue[reassignIndex]
    const isDone = reassignIndex >= reassignQueue.length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 재분류 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          height: 55, padding: '0 24px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>재분류</span>
          {!isDone && (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {reassignIndex + 1} / {reassignQueue.length}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={exitReassign}
            aria-label="재분류 종료"
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, background: 'var(--secondary)', border: '1px solid var(--border)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={14} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {isDone ? (
          // 완료 화면
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ fontSize: 52 }}>✅</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                재분류 완료!
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                {reassignQueue.length}개 공고를 재분류했습니다.
              </div>
            </div>
            <button
              onClick={exitReassign}
              style={{
                padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : (
          // 스와이프 UI
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '16px 24px', overflow: 'hidden' }}>
            {/* 카드 덱 */}
            <div style={{ position: 'relative', width: 520, flexShrink: 0 }}>
              {[2, 1].map((offset) => (
                <div
                  key={offset}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
                    transform: `translateY(${offset * 6}px) scale(${1 - offset * 0.02})`,
                    zIndex: offset,
                  }}
                />
              ))}

              <motion.div
                style={{
                  x: rx, y: ry, rotate: rRotate, opacity: rOpacity,
                  position: 'relative', zIndex: 3,
                  borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)',
                  padding: '20px 24px',
                  cursor: reassignExiting ? 'default' : 'grab',
                  touchAction: 'none', userSelect: 'none', overflow: 'hidden',
                }}
                drag={!reassignExiting}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.7}
                onDragEnd={handleReassignDragEnd}
                whileDrag={{ cursor: 'grabbing' }}
              >
                {/* 관심없음 오버레이 */}
                <motion.div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  background: 'var(--swipe-left)', opacity: rNiOpacity,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--swipe-left-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ThumbsDown size={32} color="var(--swipe-left-text)" />
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--swipe-left-text)' }}>관심없음</span>
                  </div>
                </motion.div>

                {/* 저장 오버레이 */}
                <motion.div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  background: 'var(--swipe-right)', opacity: rSaveOpacity,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--swipe-right-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bookmark size={32} color="var(--swipe-right-text)" />
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--swipe-right-text)' }}>저장</span>
                  </div>
                </motion.div>

                {/* 즐겨찾기 오버레이 */}
                <motion.div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  background: 'var(--brand-primary-bg)', opacity: rFavOpacity,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-superlike)' }}>
                      <Heart size={32} color="#fff" />
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-primary)' }}>즐겨찾기</span>
                  </div>
                </motion.div>

                {/* 카드 내용 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
                    {{ saramin: '사람인', jobkorea: '잡코리아' }[rCard.source] ?? rCard.source}
                  </span>
                  {rCard.job_type?.includes('헤드헌터') && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)' }}>
                      헤드헌터
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                    {(rCard.deadline_date || rCard.deadline) && (
                      <DeadlineMiniBadge
                        deadline_date={rCard.deadline_date}
                        deadline={rCard.deadline}
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
                            마감일: {rCard.deadline_date || rCard.deadline}
                          </span>
                        }
                      />
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: 'var(--foreground)', marginBottom: 6 }}>
                  {rCard.title}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 12 }}>
                  {rCard.company}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap', color: 'var(--muted-foreground)', marginBottom: 12 }}>
                  {rCard.location && <span>{rCard.location}</span>}
                  {rCard.experience && <span>{rCard.experience}</span>}
                  {rCard.job_type && !rCard.job_type.includes('헤드헌터') && <span>{rCard.job_type}</span>}
                </div>
                {(rCard.categories?.length > 0 || rCard.tech_stack?.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {rCard.categories?.map((c: string) => (
                      <span key={c} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>{c}</span>
                    ))}
                    {rCard.tech_stack?.map((t: string) => (
                      <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--brand-primary-subtle)', color: 'var(--color-info-foreground)' }}>{t}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <button
                aria-label="관심없음"
                onClick={() => doReassign('not_interested')}
                disabled={reassignExiting}
                className="action-btn"
                style={{ background: 'var(--color-error)', color: 'var(--color-error-foreground)', width: 56, height: 56 }}
              >
                <ThumbsDown size={20} />
              </button>
              <button
                aria-label="저장"
                onClick={() => doReassign('save')}
                disabled={reassignExiting}
                className="action-btn"
                style={{ background: 'var(--color-success)', color: 'var(--color-success-foreground)', width: 56, height: 56 }}
              >
                <Bookmark size={20} />
              </button>
              <button
                aria-label="즐겨찾기"
                onClick={() => doReassign('favorite')}
                disabled={reassignExiting}
                className="action-btn"
                style={{ background: 'var(--brand-primary)', color: '#fff', width: 72, height: 72 }}
              >
                <Heart size={26} />
              </button>
              <button
                aria-label="실행취소"
                onClick={undoReassign}
                disabled={reassignExiting || reassignHistory.length === 0}
                className="action-btn"
                style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}
              >
                <Undo2 size={20} />
              </button>
              <button
                aria-label="공고 보기"
                onClick={() => window.open(rCard.url, '_blank')}
                className="action-btn"
                style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}
              >
                <ExternalLink size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── 기존 리스트 UI ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar
        search={search}
        onSearchChange={setSearch}
        resultCount={jobs.length}
        totalCount={data?.jobs.length ?? 0}
        sort={sort}
        onSortChange={setSort}
        onAnalyzeAll={mode === 'favorites' ? analyzeAll : undefined}
        onReassign={startReassign}
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
