import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ThumbsDown, Heart, Bookmark, Undo2, Sparkles, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar } from '../components/layout/TopBar'
import { useShortcuts } from '../hooks/useShortcuts'
import type { SwipeAction } from '../types/job'

export function ScreeningPage() {
  const qc = useQueryClient()
  const { screeningJobs, notInterestedUrls, savedUrls, favoriteUrls, setScreeningData, currentCardIndex, advanceCard, undoCard } = useAppStore()

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
                <a href={current.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} style={{ color: 'var(--muted-foreground)' }} />
                </a>
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
        <div className="flex items-center gap-4">
          <button onClick={() => swipe('not_interested')} className="action-btn" style={{ background: 'var(--color-error)', color: 'var(--color-error-foreground)' }}>
            <ThumbsDown size={20} />
            <span className="text-xs">관심없음</span>
          </button>
          <button onClick={undo} className="action-btn" style={{ background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
            <Undo2 size={18} />
            <span className="text-xs">실행취소</span>
          </button>
          <button onClick={() => swipe('favorite')} className="action-btn" style={{ background: 'var(--color-success)', color: 'var(--color-success-foreground)' }}>
            <Heart size={20} />
            <span className="text-xs">즐겨찾기</span>
          </button>
          <button onClick={() => swipe('save')} className="action-btn" style={{ background: 'var(--color-warning)', color: 'var(--color-warning-foreground)' }}>
            <Bookmark size={20} />
            <span className="text-xs">저장</span>
          </button>
          <button
            onClick={() => api.analyze(current.url)}
            className="action-btn"
            style={{ background: 'var(--color-info)', color: 'var(--color-info-foreground)' }}
          >
            <Sparkles size={18} />
            <span className="text-xs">AI분석</span>
          </button>
        </div>
      </div>
    </div>
  )
}
