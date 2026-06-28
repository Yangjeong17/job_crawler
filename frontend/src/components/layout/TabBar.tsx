import { NavLink } from 'react-router-dom'
import { Layers, LayoutList, ThumbsDown, Bookmark, Heart, Calendar, Keyboard } from 'lucide-react'

const TABS = [
  { to: '/screening',     icon: Layers,      label: '스크리닝' },
  { to: '/all',           icon: LayoutList,  label: '전체 공고' },
  { to: '/not-interested',icon: ThumbsDown,  label: '관심없음' },
  { to: '/saved',         icon: Bookmark,    label: '저장' },
  { to: '/favorites',     icon: Heart,       label: '즐겨찾기' },
  { to: '/scheduler',     icon: Calendar,    label: '스케줄러' },
]

interface Props {
  onShortcutOpen?: () => void
}

export function TabBar({ onShortcutOpen }: Props) {
  return (
    <div
      className="flex items-end gap-1 shrink-0 px-2"
      style={{ height: 64, background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}
    >
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-5 text-[13px] rounded-t-md transition-colors`
            + (isActive
              ? ' font-semibold'
              : ' font-normal')
          }
          style={({ isActive }) => ({
            height: 48,
            background: isActive ? 'var(--brand-primary)' : 'transparent',
            color: isActive ? '#fff' : 'var(--muted-foreground)',
          })}
        >
          <Icon size={13} />
          {label}
        </NavLink>
      ))}

      <div className="flex-1" />

      <div className="flex items-center" style={{ height: 64 }}>
        <button
          onClick={onShortcutOpen}
          className="flex items-center gap-1.5 px-3 h-[34px] rounded-lg text-xs"
          style={{ background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <Keyboard size={12} />
          단축키
        </button>
      </div>
    </div>
  )
}
