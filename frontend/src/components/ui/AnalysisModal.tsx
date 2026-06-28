import { X, Sparkles } from 'lucide-react'

interface Props {
  loading: boolean
  result: string | null
  error: string | null
  onClose: () => void
}

export function AnalysisModal({ loading, result, error, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-xl flex flex-col"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          width: 640,
          maxWidth: '90vw',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-info-foreground)' }}>
            <Sparkles size={16} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>공고 상세분석</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 0', color: 'var(--muted-foreground)' }}>
              <div style={{ fontSize: 32 }} className="animate-pulse">✨</div>
              <p style={{ fontSize: 14 }}>공고를 분석하는 중입니다...</p>
              <p style={{ fontSize: 12 }}>상세 페이지 크롤링 후 AI 분석이 진행됩니다.</p>
            </div>
          )}

          {error && !loading && (
            <div style={{ borderRadius: 8, padding: 16, fontSize: 14, background: 'var(--color-error)', color: 'var(--color-error-foreground)' }}>
              {error}
            </div>
          )}

          {result && !loading && (
            <pre
              className="leading-relaxed whitespace-pre-wrap"
              style={{ fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit' }}
            >
              {result}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
