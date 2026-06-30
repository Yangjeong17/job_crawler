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
        style={{ width: 480, background: 'var(--sidebar)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-modal)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Keyboard size={16} style={{ color: 'var(--foreground)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, color: 'var(--foreground)' }}>단축키 설정</span>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <X size={13} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
          {ROWS.map(({ key, label, icon }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 44 }}>
              <span style={{ fontSize: 16, width: 24 }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--foreground)' }}>{label}</span>
              <button
                onClick={() => setCapturing(key)}
                style={{
                  padding: '0 12px',
                  height: 32,
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 12,
                  fontWeight: 500,
                  minWidth: 100,
                  background: capturing === key ? 'var(--brand-primary)' : 'var(--secondary)',
                  color: capturing === key ? '#fff' : 'var(--foreground)',
                  border: `1px solid ${capturing === key ? 'var(--brand-primary)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {capturing === key ? '키를 누르세요...' : displayKey(local[key])}
              </button>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 56, flexShrink: 0 }}>
          <button
            onClick={() => setLocal(DEFAULTS)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '0 16px', height: 36, borderRadius: 8, fontSize: 12, flex: 1,
              background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} /> 초기화
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '0 16px', height: 36, borderRadius: 8, fontSize: 12, fontWeight: 600, flex: 1,
              background: 'var(--color-info-foreground)', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            <Save size={12} /> 저장
          </button>
        </div>
      </div>
    </div>
  )
}
