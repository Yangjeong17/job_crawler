import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ThumbsDown, Heart, Bookmark, Undo2, Sparkles, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar } from '../components/layout/TopBar'
import { useShortcuts } from '../hooks/useShortcuts'
import { AnalysisModal } from '../components/ui/AnalysisModal'
import type { SwipeAction } from '../types/job'

export function ScreeningPage() {
  const qc = useQueryClient()
  const { screeningJobs, notInterestedUrls, savedUrls, favoriteUrls, setScreeningData, currentCardIndex, advanceCard, undoCard } = useAppStore()

  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const { data: shortcuts } = useQuery({ queryKey: ['shortcuts'], queryFn: api.shortcuts.get, staleTime: Infinity })

  const { data, isLoading } = useQuery({
    queryKey: ['jobs-screening'],
    queryFn: api.jobs.search,
  })

  useEffect(() => {
    if (data) setScreeningData(data.jobs, data.not_interested_urls, data.saved_urls, data.favorite_urls)
  }, [data])

  const pending = screeningJobs.filter(
    (j) => !notInterestedUrls.has(j.url) && !savedUrls.has(j.url) && !favoriteUrls.has(j.url)
  )

  const current = pending[currentCardIndex]

  async function openAnalysis() {
    if (!current) return
    setAnalysisResult(null)
    setAnalysisError(null)
    setAnalysisLoading(true)
    try {
      const { result } = await api.analyze(current.url)
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

  async function swipe(action: SwipeAction) {
    if (!current) return
    await api.jobs.swipe(current.url, action)
    advanceCard()
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  useShortcuts({
    onNotInterested: () => swipe('not_interested'),
    onSave:          () => swipe('save'),
    onFavorite:      () => swipe('favorite'),
    onUndo:          undo,
    onOpenUrl:       () => current && window.open(current.url, '_blank'),
  }, !!current)

  async function undo() {
    try {
      await api.jobs.undo()
      undoCard()
    } catch { /* nothing to undo */ }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }}>
        불러오는 중...
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <span className="text-4xl">✅</span>
        <p className="text-sm">모든 공고를 검토했습니다.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar search="" onSearchChange={() => {}} showLegend={false} showSourceFilter={false} />

      {/* Stats Bar */}
      <div className="flex items-center justify-center gap-6 px-6 shrink-0" style={{ height: 40, borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        {([
          ['스크리닝', pending.length - currentCardIndex, 'var(--brand-primary)'],
          ['관심없음', notInterestedUrls.size, 'var(--muted-foreground)'],
          ['저장', savedUrls.size, 'var(--color-warning-foreground)'],
          ['즐겨찾기', favoriteUrls.size, 'var(--color-success-foreground)'],
        ] as [string, number, string][]).map(([label, count, color]) => (
          <div key={label} className="flex items-center gap-1.5 text-xs">
            <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
            <span className="font-bold" style={{ color }}>{count}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <div className="flex items-center gap-1.5 text-xs">
          <span style={{ color: 'var(--muted-foreground)' }}>진행중</span>
          <span className="font-bold" style={{ color: 'var(--foreground)' }}>
            {screeningJobs.length - pending.length + currentCardIndex} / {screeningJobs.length}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {/* Card deck shadow layers */}
        <div className="relative" style={{ width: 620 }}>
          {[2, 1].map((offset) => (
            <div
              key={offset}
              className="absolute rounded-xl"
              style={{
                inset: 0,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                transform: `translateY(${offset * 6}px) scale(${1 - offset * 0.02})`,
                zIndex: offset,
              }}
            />
          ))}

          <AnimatePresence mode="wait">
            <motion.div
              key={current.url}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.2 }}
              className="relative rounded-xl p-6 flex flex-col gap-3"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', zIndex: 3 }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                >
                  {current.source}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={openAnalysis} style={{ color: 'var(--color-info-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <Sparkles size={14} />
                  </button>
                  <a href={current.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} style={{ color: 'var(--muted-foreground)' }} />
                  </a>
                </div>
              </div>

              <div className="text-xl font-bold leading-snug" style={{ color: 'var(--foreground)' }}>
                {current.title}
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
                {current.company}
              </div>

              <div className="flex gap-4 text-xs flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
                {current.location && <span>{current.location}</span>}
                {current.experience && <span>{current.experience}</span>}
                {current.job_type && <span>{current.job_type}</span>}
              </div>

              {current.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {current.tech_stack.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded" style={{ background: 'var(--secondary)', color: 'var(--color-info-foreground)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {current.deadline && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--secondary)' }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>마감일</span>
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{current.deadline}</span>
                  {current.salary && (
                    <>
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <span style={{ color: 'var(--color-success-foreground)' }}>{current.salary}</span>
                    </>
                  )}
                </div>
              )}

              <div className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                {pending.length - currentCardIndex}개 남음
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-5">
            <button onClick={() => swipe('not_interested')} className="action-btn" style={{ background: 'var(--color-error)', color: 'var(--color-error-foreground)', width: 56, height: 56 }}>
              <ThumbsDown size={20} />
            </button>
            <button onClick={() => swipe('save')} className="action-btn" style={{ background: 'var(--color-warning)', color: 'var(--color-warning-foreground)', width: 56, height: 56 }}>
              <Bookmark size={20} />
            </button>
            <button onClick={() => swipe('favorite')} className="action-btn" style={{ background: 'var(--color-success)', color: 'var(--color-success-foreground)', width: 72, height: 72 }}>
              <Heart size={26} />
            </button>
            <button onClick={undo} className="action-btn" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}>
              <Undo2 size={20} />
            </button>
            <button onClick={() => current && window.open(current.url, '_blank')} className="action-btn" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}>
              <ExternalLink size={20} />
            </button>
          </div>

          {shortcuts && (
            <div className="flex items-center gap-4">
              {([
                [shortcuts.not_interested, '관심없음'],
                [shortcuts.save, '저장'],
                [shortcuts.favorite, '즐겨찾기'],
                [shortcuts.undo, '실행취소'],
                [shortcuts.open_url, '공고보기'],
              ] as [string, string][]).map(([key, label]) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
                    {({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' } as Record<string,string>)[key] ?? key}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
