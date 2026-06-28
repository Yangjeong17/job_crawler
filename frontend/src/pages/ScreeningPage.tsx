import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { ThumbsDown, Heart, Bookmark, Undo2, Sparkles, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar } from '../components/layout/TopBar'
import { useShortcuts } from '../hooks/useShortcuts'
import { AnalysisModal } from '../components/ui/AnalysisModal'
import { GuidePage } from './GuidePage'
import type { SwipeAction } from '../types/job'

export function ScreeningPage() {
  const qc = useQueryClient()
  const {
    screeningJobs, notInterestedUrls, savedUrls, favoriteUrls,
    setScreeningData, currentCardIndex, advanceCard, undoCard,
    sourceFilter,
  } = useAppStore()

  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  const { data: shortcuts } = useQuery({ queryKey: ['shortcuts'], queryFn: api.shortcuts.get, staleTime: Infinity })
  const { data, isLoading } = useQuery({ queryKey: ['jobs-screening'], queryFn: api.jobs.search })

  useEffect(() => {
    if (data) setScreeningData(data.jobs, data.not_interested_urls, data.saved_urls, data.favorite_urls)
  }, [data])

  const pending = screeningJobs.filter(
    (j) =>
      !notInterestedUrls.has(j.url) && !savedUrls.has(j.url) && !favoriteUrls.has(j.url) &&
      (!sourceFilter || j.source === sourceFilter)
  )
  const current = pending[currentCardIndex]

  // Motion values for drag & exit animation
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const cardOpacity = useMotionValue(1)
  const rotate = useTransform(x, [-300, 300], [-15, 15])

  // Overlay opacities driven by drag position
  const notInterestedOpacity = useTransform(x, [-50, -150], [0, 1])
  const saveOpacity           = useTransform(x, [50, 150], [0, 1])
  const favoriteOpacity       = useTransform(y, [-50, -150], [0, 1])

  async function triggerSwipe(action: SwipeAction) {
    if (!current || isExiting) return
    setIsExiting(true)

    // Phase 1: 오버레이 색상 보여주기
    const show = {
      not_interested: { x: -130, y: 0 },
      save:           { x: 130,  y: 0 },
      favorite:       { x: 0,    y: -130 },
    }[action]
    await Promise.all([
      animate(x, show.x, { duration: 0.2, ease: 'easeOut' }),
      animate(y, show.y, { duration: 0.2, ease: 'easeOut' }),
    ])
    // Phase 2: 카드 날아가기
    const flyOff = {
      not_interested: { x: -700, y: 80 },
      save:           { x: 700,  y: 80 },
      favorite:       { x: 0,    y: -700 },
    }[action]
    await Promise.all([
      animate(x, flyOff.x, { duration: 0.3, ease: 'easeIn' }),
      animate(y, flyOff.y, { duration: 0.3, ease: 'easeIn' }),
      animate(cardOpacity, 0, { duration: 0.25, delay: 0.08 }),
    ])

    await api.jobs.swipe(current.url, action)
    advanceCard()
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['jobs-saved'] })
    qc.invalidateQueries({ queryKey: ['jobs-fav'] })

    // Reset position while invisible, then fade in new card
    x.set(0)
    y.set(0)
    await new Promise((r) => setTimeout(r, 16))
    await animate(cardOpacity, 1, { duration: 0.18 })
    setIsExiting(false)
  }

  function handleDragEnd(_: any, info: PanInfo) {
    const { offset, velocity } = info
    if      (offset.x < -100 || velocity.x < -500) triggerSwipe('not_interested')
    else if (offset.x >  100 || velocity.x >  500) triggerSwipe('save')
    else if (offset.y < -100 || velocity.y < -500) triggerSwipe('favorite')
    else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 })
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 })
    }
  }

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

  async function undo() {
    try {
      await api.jobs.undo()
      undoCard()
    } catch { /* nothing to undo */ }
  }

  useShortcuts({
    onNotInterested: () => triggerSwipe('not_interested'),
    onSave:          () => triggerSwipe('save'),
    onFavorite:      () => triggerSwipe('favorite'),
    onUndo:          undo,
    onOpenUrl:       () => current && window.open(current.url, '_blank'),
  }, !!current && !isExiting)

  const totalProcessed = screeningJobs.length - pending.length + currentCardIndex

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
        불러오는 중...
      </div>
    )
  }

  // DB가 비어있으면 가이드 화면
  if (!isLoading && data && data.jobs.length === 0) {
    return <GuidePage />
  }

  if (!current) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted-foreground)' }}>
        <span style={{ fontSize: 36 }}>✅</span>
        <p style={{ fontSize: 14 }}>모든 공고를 검토했습니다.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar search="" onSearchChange={() => {}} showLegend={false} showSourceFilter />

      {/* Stats Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexShrink: 0, height: 40, padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        {([
          ['스크리닝', pending.length - currentCardIndex, 'var(--brand-primary)'],
          ['관심없음', notInterestedUrls.size, 'var(--muted-foreground)'],
          ['저장', savedUrls.size, 'var(--color-warning-foreground)'],
          ['즐겨찾기', favoriteUrls.size, 'var(--color-success-foreground)'],
        ] as [string, number, string][]).map(([label, count, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
            <span style={{ fontWeight: 700, color }}>{count}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--muted-foreground)' }}>진행중</span>
          <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
            {totalProcessed} / {screeningJobs.length}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '16px 24px', overflow: 'hidden' }}>

        {/* Progress Area (zc177) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>진행중</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
            {totalProcessed} / {screeningJobs.length}
          </span>
        </div>

        {/* Card deck */}
        <div style={{ position: 'relative', width: 620, flexShrink: 0 }}>
          {/* Shadow layers */}
          {[2, 1].map((offset) => (
            <div
              key={offset}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                transform: `translateY(${offset * 6}px) scale(${1 - offset * 0.02})`,
                zIndex: offset,
              }}
            />
          ))}

          {/* Draggable card */}
          <motion.div
            style={{
              x, y, rotate, opacity: cardOpacity,
              position: 'relative',
              zIndex: 3,
              borderRadius: 12,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              padding: '20px 24px',
              cursor: isExiting ? 'default' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
              overflow: 'hidden',
            }}
            drag={!isExiting}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            whileDrag={{ cursor: 'grabbing' }}
          >
            {/* 관심없음 overlay */}
            <motion.div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'var(--color-error)',
              opacity: notInterestedOpacity,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-error-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ThumbsDown size={32} color="var(--background)" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-error-foreground)' }}>관심없음</span>
              </div>
            </motion.div>

            {/* 저장 overlay */}
            <motion.div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'var(--color-success)',
              opacity: saveOpacity,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-success-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bookmark size={32} color="var(--background)" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-success-foreground)' }}>저장</span>
              </div>
            </motion.div>

            {/* 즐겨찾기 overlay */}
            <motion.div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'var(--brand-primary-bg)',
              opacity: favoriteOpacity,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'var(--brand-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 40px 16px rgba(79,124,246,0.3)',
                }}>
                  <Heart size={32} color="#fff" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-primary)' }}>즐겨찾기</span>
              </div>
            </motion.div>

            {/* Card content */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
                {current.source}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={openAnalysis} style={{ color: 'var(--color-info-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Sparkles size={14} />
                </button>
                <a href={current.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} style={{ color: 'var(--muted-foreground)' }} />
                </a>
              </div>
            </div>

            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: 'var(--foreground)', marginBottom: 4 }}>
              {current.title}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 12 }}>
              {current.company}
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap', color: 'var(--muted-foreground)', marginBottom: 8 }}>
              {current.location && <span>{current.location}</span>}
              {current.experience && <span>{current.experience}</span>}
              {current.job_type && <span>{current.job_type}</span>}
            </div>

            {current.tech_stack.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {current.tech_stack.map((t) => (
                  <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--secondary)', color: 'var(--color-info-foreground)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {current.deadline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: 'var(--secondary)', marginBottom: 8 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>마감일</span>
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{current.deadline}</span>
                {current.salary && (
                  <>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span style={{ color: 'var(--color-success-foreground)' }}>{current.salary}</span>
                  </>
                )}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {pending.length - currentCardIndex}개 남음
            </div>
          </motion.div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button onClick={() => triggerSwipe('not_interested')} disabled={isExiting} className="action-btn" style={{ background: 'var(--color-error)', color: 'var(--color-error-foreground)', width: 56, height: 56 }}>
              <ThumbsDown size={20} />
            </button>
            <button onClick={() => triggerSwipe('save')} disabled={isExiting} className="action-btn" style={{ background: 'var(--color-success)', color: 'var(--color-success-foreground)', width: 56, height: 56 }}>
              <Bookmark size={20} />
            </button>
            <button onClick={() => triggerSwipe('favorite')} disabled={isExiting} className="action-btn" style={{ background: 'var(--brand-primary)', color: '#fff', width: 72, height: 72 }}>
              <Heart size={26} />
            </button>
            <button onClick={undo} disabled={isExiting} className="action-btn" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}>
              <Undo2 size={20} />
            </button>
            <button onClick={() => current && window.open(current.url, '_blank')} className="action-btn" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}>
              <ExternalLink size={20} />
            </button>
          </div>

          {shortcuts && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {([
                [shortcuts.not_interested, '관심없음'],
                [shortcuts.save, '저장'],
                [shortcuts.favorite, '즐겨찾기'],
                [shortcuts.undo, '실행취소'],
                [shortcuts.open_url, '공고보기'],
              ] as [string, string][]).map(([key, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
                    {({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' } as Record<string, string>)[key] ?? key}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{label}</span>
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

  function closeAnalysis() {
    setAnalysisResult(null)
    setAnalysisError(null)
    setAnalysisLoading(false)
  }
}
