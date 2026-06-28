import { NavLink } from 'react-router-dom'
import { Keyboard } from 'lucide-react'

const TABS = [
  { to: '/screening',      label: '스크리닝' },
  { to: '/all',            label: '전체 공고' },
  { to: '/not-interested', label: '관심없음' },
  { to: '/saved',          label: '저장' },
  { to: '/favorites',      label: '즐겨찾기' },
  { to: '/scheduler',      label: '스케줄러' },
]

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
      {TABS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            height: 48,
            padding: '0 20px',
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
          {label}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', height: 64 }}>
        <button
          onClick={onShortcutOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px',
            height: 34,
            borderRadius: 8,
            fontSize: 12,
            background: 'var(--secondary)',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
          }}
        >
          <Keyboard size={12} />
          단축키
        </button>
      </div>
    </div>
  )
}
