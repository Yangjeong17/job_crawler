import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Keyboard, X, RotateCcw, Save } from 'lucide-react'
import { api } from '../../api/client'
import type { Shortcuts } from '../../types/job'

interface Props {
  open: boolean
  onClose: () => void
}

const ROWS: { key: keyof Shortcuts; label: string; icon: string }[] = [
  { key: 'not_interested', label: '관심없음',  icon: '👎' },
  { key: 'favorite',       label: '즐겨찾기',  icon: '⭐' },
  { key: 'save',           label: '저장',      icon: '🔖' },
  { key: 'open_url',       label: '공고 보기', icon: '🔗' },
  { key: 'undo',           label: '실행취소',  icon: '↩' },
]

const DEFAULTS: Shortcuts = {
  not_interested: 'ArrowLeft',
  save:           'ArrowRight',
  favorite:       '0',
  undo:           'ArrowUp',
  open_url:       'ArrowDown',
}

function displayKey(key: string) {
  const map: Record<string, string> = {
    ArrowLeft: '← 왼쪽', ArrowRight: '→ 오른쪽',
    ArrowUp: '↑ 위', ArrowDown: '↓ 아래',
    ' ': 'Space', Escape: 'Esc', Enter: 'Enter',
  }
  return map[key] ?? key
}

export function ShortcutModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['shortcuts'], queryFn: api.shortcuts.get, staleTime: Infinity })
  const [local, setLocal] = useState<Shortcuts>(DEFAULTS)
  const [capturing, setCapturing] = useState<keyof Shortcuts | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data) setLocal(data) }, [data])

  useEffect(() => {
    if (!capturing) return
    function onKey(e: KeyboardEvent) {
      e.preventDefault()
      setLocal((prev) => ({ ...prev, [capturing as string]: e.key } as Shortcuts))
      setCapturing(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [capturing])

  async function handleSave() {
    setSaving(true)
    await api.shortcuts.save(local)
    qc.invalidateQueries({ queryKey: ['shortcuts'] })
    setSaving(false)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{ width: 480, background: 'var(--sidebar)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14" style={{ borderBottom: '1px solid var(--border)' }}>
          <Keyboard size={16} style={{ color: 'var(--foreground)' }} />
          <span className="font-semibold text-sm flex-1" style={{ color: 'var(--foreground)' }}>단축키 설정</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <X size={13} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Rows */}
        <div className="flex flex-col py-2">
          {ROWS.map(({ key, label, icon }) => (
            <div key={key} className="flex items-center gap-3 px-5 h-11">
              <span className="text-base w-6">{icon}</span>
              <span className="flex-1 text-sm" style={{ color: 'var(--foreground)' }}>{label}</span>
              <button
                onClick={() => setCapturing(key)}
                className="px-3 h-8 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: capturing === key ? 'var(--brand-primary)' : 'var(--secondary)',
                  color: capturing === key ? '#fff' : 'var(--foreground)',
                  border: `1px solid ${capturing === key ? 'var(--brand-primary)' : 'var(--border)'}`,
                  minWidth: 100,
                }}
              >
                {capturing === key ? '키를 누르세요...' : displayKey(local[key])}
              </button>
            </div>
          ))}
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 h-14">
          <button
            onClick={() => setLocal(DEFAULTS)}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-xs flex-1"
            style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            <RotateCcw size={12} /> 초기화
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-xs flex-1 font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-info-foreground)', color: '#fff' }}
          >
            <Save size={12} /> 저장
          </button>
        </div>
      </div>
    </div>
  )
}
