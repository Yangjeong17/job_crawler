import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Keyboard, BookOpen, Layers, LayoutList, ThumbsDown, Bookmark, Heart, PanelLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useViewportWidth } from '../../hooks/useViewportWidth'

const MINI_BREAKPOINT = 600

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/screening',      label: '스크리닝',  icon: Layers },
  { to: '/all',            label: '전체 공고', icon: LayoutList },
  { to: '/not-interested', label: '관심없음',  icon: ThumbsDown },
  { to: '/saved',          label: '저장',      icon: Bookmark },
  { to: '/favorites',      label: '즐겨찾기',  icon: Heart },
]

const AUX_BTN_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 12px',
  height: 34,
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  background: 'var(--secondary)',
  border: '1px solid var(--border)',
  color: 'var(--muted-foreground)',
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 4,
  height: 64,
  padding: '0 8px',
}

interface Props {
  onShortcutOpen?: () => void
}

export function TabBar({ onShortcutOpen }: Props) {
  const { sidebarOpen, toggleSidebar } = useAppStore()
  const viewportWidth = useViewportWidth()
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const isMini = overflowing || viewportWidth <= MINI_BREAKPOINT

  // 라벨을 포함한 "정상" 상태가 실제로 들어갈 폭이 되는지, 숨겨진 복제본으로 측정
  useLayoutEffect(() => {
    function check() {
      if (!containerRef.current || !measureRef.current) return
      setOverflowing(measureRef.current.scrollWidth > containerRef.current.clientWidth)
    }
    check()
    const ro = new ResizeObserver(check)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [sidebarOpen])

  return (
    <div style={{ position: 'relative', flexShrink: 0, overflow: 'hidden', background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
      {/* 측정 전용 숨김 복제본 — 라벨 항상 표시된 상태로 필요한 실제 폭을 잰다 */}
      <div
        ref={measureRef}
        aria-hidden
        style={{ ...ROW_STYLE, position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'hidden' }}
      >
        <div style={{ ...AUX_BTN_BASE, flexShrink: 0 }}><PanelLeft size={14} /></div>
        {TABS.map(({ to, label }) => (
          <div key={to} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <span style={{ width: 14, height: 14, flexShrink: 0 }} />
            {label}
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 24 }} />
        <div style={{ ...AUX_BTN_BASE, flexShrink: 0 }}><BookOpen size={12} />사용법</div>
        <div style={{ ...AUX_BTN_BASE, flexShrink: 0 }}><Keyboard size={12} />단축키</div>
      </div>

      <div ref={containerRef} style={ROW_STYLE}>
        {/* 사이드바 토글 — 위치는 임시, 추후 확정. 항상 고정 크기 유지 */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
          className="sidebar-toggle-btn"
          style={{ ...AUX_BTN_BASE, height: 34, marginBottom: 8, flexShrink: 0, background: undefined, border: undefined }}
        >
          <PanelLeft size={14} />
        </button>

        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 48,
              flexShrink: 0,
              padding: isMini ? '0 12px' : '0 16px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              borderRadius: '6px 6px 0 0',
              background: isActive ? 'var(--brand-primary)' : 'transparent',
              color: isActive ? '#fff' : 'var(--muted-foreground)',
              textDecoration: 'none',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            })}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            {!isMini && label}
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 64 }}>
          <NavLink
            to="/guide"
            aria-label="사용법"
            style={({ isActive }) => ({
              ...AUX_BTN_BASE,
              flexShrink: 0,
              ...(isActive ? {
                background: 'var(--brand-primary-bg)',
                color: 'var(--brand-primary)',
                borderColor: 'var(--brand-primary)',
              } : {}),
            })}
          >
            <BookOpen size={12} style={{ flexShrink: 0 }} />
            {!isMini && '사용법'}
          </NavLink>

          <button onClick={onShortcutOpen} aria-label="단축키" style={{ ...AUX_BTN_BASE, flexShrink: 0 }}>
            <Keyboard size={12} style={{ flexShrink: 0 }} />
            {!isMini && '단축키'}
          </button>
        </div>
      </div>
    </div>
  )
}
