import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { ThumbsDown, Heart, Bookmark, Undo2, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { TopBar } from '../components/layout/TopBar'
import { useShortcuts } from '../hooks/useShortcuts'
import { GuidePage } from './GuidePage'
import type { SwipeAction } from '../types/job'
import { JobCardInfo } from '../components/ui/JobCardInfo'

const CRAWL_EMOJIS = ['🔍', '🌐', '📋', '⚡', '🤖', '💫']

export function ScreeningPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const {
    screeningJobs, notInterestedUrls, savedUrls, favoriteUrls,
    setScreeningData, applySwipe, revertSwipe,
    sourceFilter, crawling, crawlLog,
  } = useAppStore()

  const [search, setSearch] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const [emojiIdx, setEmojiIdx] = useState(0)
  const emojiTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (crawling) {
      emojiTimer.current = setInterval(() => setEmojiIdx((i) => (i + 1) % CRAWL_EMOJIS.length), 700)
    } else {
      if (emojiTimer.current) clearInterval(emojiTimer.current)
    }
    return () => { if (emojiTimer.current) clearInterval(emojiTimer.current) }
  }, [crawling])

  const { data: shortcuts } = useQuery({ queryKey: ['shortcuts'], queryFn: api.shortcuts.get, staleTime: Infinity })
  const { data, isLoading } = useQuery({ queryKey: ['jobs-screening'], queryFn: api.jobs.search })

  useEffect(() => {
    if (data) setScreeningData(data.jobs, data.not_interested_urls, data.saved_urls, data.favorite_urls)
  }, [data, setScreeningData])

  // 검색어/소스 필터와 무관하게 실제로 아직 스와이프하지 않은 공고 (완료 판정용)
  const remainingAll = screeningJobs.filter(
    (j) => !notInterestedUrls.has(j.url) && !savedUrls.has(j.url) && !favoriteUrls.has(j.url)
  )
  const pending = remainingAll.filter(
    (j) =>
      (!sourceFilter || j.source === sourceFilter) &&
      (!search || j.title.includes(search) || j.company.includes(search))
  )
  const current = pending[0]

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
    applySwipe(current.url, action)
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['jobs-saved'] })
    qc.invalidateQueries({ queryKey: ['jobs-fav'] })
    qc.invalidateQueries({ queryKey: ['jobs-ni'] })

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

  async function undo() {
    try {
      const { url, action } = await api.jobs.undo()
      revertSwipe(url, action)
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['jobs-saved'] })
      qc.invalidateQueries({ queryKey: ['jobs-fav'] })
      qc.invalidateQueries({ queryKey: ['jobs-ni'] })
    } catch { /* nothing to undo */ }
  }

  useShortcuts({
    onNotInterested: () => triggerSwipe('not_interested'),
    onSave:          () => triggerSwipe('save'),
    onFavorite:      () => triggerSwipe('favorite'),
    onUndo:          undo,
    onOpenUrl:       () => current && window.open(current.url, '_blank'),
  }, !!current && !isExiting)

  const totalProcessed = screeningJobs.length - remainingAll.length

  // 현황바 실측 오버플로우 감지 — 라벨 포함 폭이 실제 컨테이너에 안 들어가면 숫자만 표시
  const statsContainerRef = useRef<HTMLDivElement>(null)
  const statsMeasureRef = useRef<HTMLDivElement>(null)
  const [statsOverflowing, setStatsOverflowing] = useState(false)

  useLayoutEffect(() => {
    function check() {
      if (!statsContainerRef.current || !statsMeasureRef.current) return
      setStatsOverflowing(statsMeasureRef.current.scrollWidth > statsContainerRef.current.clientWidth)
    }
    check()
    const ro = new ResizeObserver(check)
    if (statsContainerRef.current) ro.observe(statsContainerRef.current)
    return () => ro.disconnect()
  }, [pending.length, notInterestedUrls.size, savedUrls.size, favoriteUrls.size, totalProcessed, screeningJobs.length])

  const centeredStateStyle: CSSProperties = {
    flex: 1,
    minHeight: 'calc(100vh - 154px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: '24px 40px',
    boxSizing: 'border-box',
  }

  // 검색 중 화면
  if (crawling) {
    return (
      <div style={{ ...centeredStateStyle, gap: 28 }}>
        <div style={{ fontSize: 72, lineHeight: 1, transition: 'opacity 0.3s' }}>
          {CRAWL_EMOJIS[emojiIdx]}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>
            공고 검색 중...
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            검색이 완료되면 자동으로 스크리닝 화면으로 전환됩니다
          </div>
        </div>
        {crawlLog.length > 0 && (
          <div style={{
            width: '100%', maxWidth: 480, padding: '12px 16px', borderRadius: 10,
            background: 'var(--card)', border: '1px solid var(--border)',
            fontSize: 11, lineHeight: 1.8, color: 'var(--muted-foreground)',
            maxHeight: 160, overflowY: 'auto',
          }}>
            {crawlLog.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ ...centeredStateStyle, color: 'var(--muted-foreground)' }}>
        불러오는 중...
      </div>
    )
  }

  // DB가 비어있으면 가이드 화면
  if (!isLoading && data && data.jobs.length === 0) {
    return <GuidePage />
  }

  // 스와이프 완료 화면 (Screen 1-2) — 검색/소스 필터로 목록이 비어 보이는 것과는 구분
  if (remainingAll.length === 0) {
    return (
      <div style={centeredStateStyle}>
        <div style={{ fontSize: 60 }}>🎉</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
            스크리닝 완료!
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            모든 공고를 검토했습니다.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {([
            ['저장', savedUrls.size, 'var(--color-warning-foreground)'],
            ['즐겨찾기', favoriteUrls.size, 'var(--brand-primary)'],
            ['관심없음', notInterestedUrls.size, 'var(--muted-foreground)'],
          ] as [string, number, string][]).map(([label, count, color]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/saved')}
          style={{
            padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          저장 공고 확인하기 →
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar search={search} onSearchChange={setSearch} resultCount={pending.length} totalCount={remainingAll.length} showLegend={false} showSourceFilter />

      {/* Stats Bar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* 측정 전용 숨김 복제본 — 라벨 항상 표시된 상태로 필요한 실제 폭을 잰다 */}
        <div
          ref={statsMeasureRef}
          aria-hidden
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, height: 40, padding: '0 24px', position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' }}
        >
          {([
            ['스크리닝', pending.length, 'var(--brand-primary)'],
            ['관심없음', notInterestedUrls.size, 'var(--muted-foreground)'],
            ['저장', savedUrls.size, 'var(--color-warning-foreground)'],
            ['즐겨찾기', favoriteUrls.size, 'var(--color-success-foreground)'],
          ] as [string, number, string][]).map(([label, count, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap' }}>
              <span>{label}</span>
              <span style={{ fontWeight: 700, color }}>{count}</span>
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap' }}>
            <span>진행중</span>
            <span style={{ fontWeight: 700 }}>{totalProcessed} / {screeningJobs.length}</span>
          </div>
        </div>

        <div
          ref={statsContainerRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: statsOverflowing ? 'flex-start' : 'center',
            gap: statsOverflowing ? 14 : 24,
            height: 40,
            padding: '0 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)',
            overflowX: 'auto',
          }}
        >
          {statsOverflowing ? (
            <>
              {([
                ['스크리닝', pending.length, 'var(--brand-primary)'],
                ['관심없음', notInterestedUrls.size, 'var(--muted-foreground)'],
                ['저장', savedUrls.size, 'var(--color-warning-foreground)'],
                ['즐겨찾기', favoriteUrls.size, 'var(--color-success-foreground)'],
              ] as [string, number, string][]).map(([label, count, color]) => (
                <span key={label} style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {count}
                </span>
              ))}
              <div style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {totalProcessed} / {screeningJobs.length}
              </span>
            </>
          ) : (
            <>
              {([
                ['스크리닝', pending.length, 'var(--brand-primary)'],
                ['관심없음', notInterestedUrls.size, 'var(--muted-foreground)'],
                ['저장', savedUrls.size, 'var(--color-warning-foreground)'],
                ['즐겨찾기', favoriteUrls.size, 'var(--color-success-foreground)'],
              ] as [string, number, string][]).map(([label, count, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
                  <span style={{ fontWeight: 700, color }}>{count}</span>
                </div>
              ))}
              <div style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>진행중</span>
                <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                  {totalProcessed} / {screeningJobs.length}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '16px 24px', overflow: 'hidden' }}>

        {/* Progress Area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>진행중</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
            {totalProcessed} / {screeningJobs.length}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {pending.length}개 남음
          </span>
        </div>

        {!current ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>검색 결과가 없습니다</div>
            <div style={{ fontSize: 12 }}>다른 검색어나 필터를 시도해보세요</div>
          </div>
        ) : (
        <>
        {/* Card deck */}
        <div style={{ position: 'relative', width: 520, flexShrink: 0 }}>
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
              background: 'var(--swipe-left)',
              opacity: notInterestedOpacity,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--swipe-left-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ThumbsDown size={32} color="var(--swipe-left-text)" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--swipe-left-text)' }}>관심없음</span>
              </div>
            </motion.div>

            {/* 저장 overlay */}
            <motion.div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'var(--swipe-right)',
              opacity: saveOpacity,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--swipe-right-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bookmark size={32} color="var(--swipe-right-text)" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--swipe-right-text)' }}>저장</span>
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
                  boxShadow: 'var(--shadow-superlike)',
                }}>
                  <Heart size={32} color="#fff" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-primary)' }}>즐겨찾기</span>
              </div>
            </motion.div>

            {/* Card content */}
            <JobCardInfo job={current} />
          </motion.div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button aria-label="관심없음" onClick={() => triggerSwipe('not_interested')} disabled={isExiting} className="action-btn" style={{ background: 'var(--color-error)', color: 'var(--color-error-foreground)', width: 56, height: 56 }}>
              <ThumbsDown size={20} />
            </button>
            <button aria-label="저장" onClick={() => triggerSwipe('save')} disabled={isExiting} className="action-btn" style={{ background: 'var(--color-success)', color: 'var(--color-success-foreground)', width: 56, height: 56 }}>
              <Bookmark size={20} />
            </button>
            <button aria-label="즐겨찾기" onClick={() => triggerSwipe('favorite')} disabled={isExiting} className="action-btn" style={{ background: 'var(--brand-primary)', color: '#fff', width: 72, height: 72 }}>
              <Heart size={26} />
            </button>
            <button aria-label="실행취소" onClick={undo} disabled={isExiting} className="action-btn" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}>
              <Undo2 size={20} />
            </button>
            <button aria-label="공고 보기" onClick={() => current && window.open(current.url, '_blank')} className="action-btn" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', width: 56, height: 56 }}>
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
        </>
        )}
      </div>

    </div>
  )
}
