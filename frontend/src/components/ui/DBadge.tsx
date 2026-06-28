interface Props {
  deadline: string
}

function parseDays(deadline: string): number | null {
  if (!deadline) return null
  const skip = ['상시', '채용시', '수시', '마감시']
  if (skip.some((k) => deadline.includes(k))) return null

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

export function DBadge({ deadline }: Props) {
  if (!deadline) return null

  const skip = ['상시', '채용시', '수시', '마감시']
  if (skip.some((k) => deadline.includes(k))) {
    return (
      <div
        className="flex items-center justify-center text-[12px] font-bold leading-tight text-center shrink-0"
        style={{
          width: 55,
          alignSelf: 'stretch',
          background: '#2a2a2a',
          color: '#888',
          borderRadius: '10px 0 0 10px',
        }}
      >
        채용시<br />마감
      </div>
    )
  }

  const days = parseDays(deadline)
  if (days === null) return null

  let bg = 'var(--color-success)'
  let fg = 'var(--color-success-foreground)'
  let label = `D-${days}`

  if (days < 0) {
    bg = '#1a1a1a'; fg = '#555'; label = '마감'
  } else if (days <= 3) {
    bg = 'var(--color-error)'; fg = 'var(--color-error-foreground)'
  } else if (days <= 7) {
    bg = 'var(--color-warning)'; fg = 'var(--color-warning-foreground)'
  }

  return (
    <div
      className="flex items-center justify-center text-[14px] font-bold shrink-0"
      style={{
        width: 55,
        alignSelf: 'stretch',
        background: bg,
        color: fg,
        borderRadius: '10px 0 0 10px',
      }}
    >
      {label}
    </div>
  )
}
