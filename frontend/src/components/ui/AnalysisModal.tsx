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
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--color-info-foreground)' }}>
            <Sparkles size={16} />
            <span className="text-sm font-semibold">공고 상세분석</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted-foreground)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12" style={{ color: 'var(--muted-foreground)' }}>
              <div className="text-2xl animate-pulse">✨</div>
              <p className="text-sm">공고를 분석하는 중입니다...</p>
              <p className="text-xs">상세 페이지 크롤링 후 AI 분석이 진행됩니다.</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg p-4 text-sm" style={{ background: 'var(--color-error)', color: 'var(--color-error-foreground)' }}>
              {error}
            </div>
          )}

          {result && !loading && (
            <pre
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
            >
              {result}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
