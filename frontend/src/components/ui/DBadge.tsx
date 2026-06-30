import type { ReactNode } from 'react'

interface Props {
  deadline?: string | null
}

function isOpenUntilFilled(deadline: string): boolean {
  const skip = ['상시', '채용시', '수시', '마감시']
  return skip.some((k) => deadline.includes(k))
}

function parseDays(deadline: string): number | null {
  if (!deadline) return null

  if (deadline.includes('오늘마감') || deadline.includes('오늘 마감')) {
    return 0
  }

  const clean = deadline.replace(/[~까지\s]/g, '')
  const formats = [
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
    /(\d{1,2})[.\-/](\d{1,2})/,
  ]

  for (const fmt of formats) {
    const m = clean.match(fmt)
    if (m) {
      const year = m[3] ? parseInt(m[1]) : new Date().getFullYear()
      const month = m[3] ? parseInt(m[2]) : parseInt(m[1])
      const day = m[3] ? parseInt(m[3]) : parseInt(m[2])
      const target = new Date(year, month - 1, day)
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      return Math.ceil((target.getTime() - now.getTime()) / 86400000)
    }
  }
  return null
}

interface DeadlineBadgeMeta {
  days: number
  bg: string
  fg: string
  label: string
  isToday: boolean
}

function getDeadlineBadgeMeta(deadline?: string | null): DeadlineBadgeMeta | null {
  if (!deadline) return null

  const days = parseDays(deadline)
  if (days === null) return null

  const isToday = days === 0

  let bg = 'var(--color-success)'
  let fg = 'var(--color-success-foreground)'
  let label = isToday ? 'D-day' : `D-${days}`

  if (days < 0) {
    bg = 'var(--secondary)'
    fg = 'var(--muted-foreground)'
    label = '마감'
  } else if (days <= 3) {
    bg = 'var(--color-error)'
    fg = 'var(--color-error-foreground)'
  } else if (days <= 7) {
    bg = 'var(--color-warning)'
    fg = 'var(--color-warning-foreground)'
  }

  return { days, bg, fg, label, isToday }
}

interface DeadlineMiniBadgeProps {
  deadline?: string | null
  onlyUrgent?: boolean
  fallback?: ReactNode
}

export function DeadlineMiniBadge({ deadline, onlyUrgent = false, fallback = null }: DeadlineMiniBadgeProps) {
  const meta = getDeadlineBadgeMeta(deadline)

  if (!meta) return <>{fallback}</>

  if (onlyUrgent && (meta.days < 0 || meta.days > 7)) {
    return <>{fallback}</>
  }

  const borderColor = meta.isToday ? 'var(--color-warning-foreground)' : meta.fg

  return (
    <span
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 6,
        fontWeight: meta.isToday ? 800 : 700,
        background: 'transparent',
        color: meta.fg,
        border: `0.5px solid ${borderColor}`,
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  )
}

export function DBadge({ deadline }: Props) {
  if (!deadline) return null

  const meta = getDeadlineBadgeMeta(deadline)

  if (!meta) {
    if (isOpenUntilFilled(deadline)) {
      return (
        <div
          className="flex items-center justify-center text-[12px] font-bold leading-tight text-center shrink-0"
          style={{
            width: 55,
            alignSelf: 'stretch',
            background: 'var(--badge-gray-bg)',
            color: 'var(--badge-gray-text)',
            borderRadius: '10px 0 0 10px',
          }}
        >
          채용시<br />마감
        </div>
      )
    }

    return null
  }

  return (
    <div
      className="flex items-center justify-center text-[14px] font-bold shrink-0"
      style={{
        width: 55,
        alignSelf: 'stretch',
        background: meta.bg,
        color: meta.fg,
        borderRadius: '10px 0 0 10px',
        border: meta.isToday ? '0.5px solid var(--color-warning-foreground)' : 'none',
        boxSizing: 'border-box',
        fontWeight: meta.isToday ? 800 : 700,
      }}
    >
      {meta.label}
    </div>
  )
}
