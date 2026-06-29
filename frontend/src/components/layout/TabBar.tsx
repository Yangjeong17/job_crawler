import { NavLink } from 'react-router-dom'
import { Keyboard, BookOpen, Layers, LayoutList, ThumbsDown, Bookmark, Heart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

interface Props {
  onShortcutOpen?: () => void
}

export function TabBar({ onShortcutOpen }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        flexShrink: 0,
        height: 64,
        padding: '0 8px',
        background: 'var(--sidebar)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 48,
            padding: '0 16px',
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
          <Icon size={14} />
          {label}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 64 }}>
        <NavLink
          to="/guide"
          style={({ isActive }) => ({
            ...AUX_BTN_BASE,
            ...(isActive ? {
              background: 'var(--brand-primary-bg)',
              color: 'var(--brand-primary)',
              borderColor: 'var(--brand-primary)',
            } : {}),
          })}
        >
          <BookOpen size={12} />
          사용법
        </NavLink>

        <button onClick={onShortcutOpen} style={AUX_BTN_BASE}>
          <Keyboard size={12} />
          단축키
        </button>
      </div>
    </div>
  )
}
