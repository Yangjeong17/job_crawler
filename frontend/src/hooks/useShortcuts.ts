import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

type Handler = () => void

interface ShortcutHandlers {
  onNotInterested?: Handler
  onSave?: Handler
  onFavorite?: Handler
  onUndo?: Handler
  onOpenUrl?: Handler
}

export function useShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const { data: shortcuts } = useQuery({
    queryKey: ['shortcuts'],
    queryFn: api.shortcuts.get,
    staleTime: Infinity,
  })

  // ref로 최신 handlers 유지 → effect 재실행 없이 항상 최신 함수 호출
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled || !shortcuts) return
    const s = shortcuts

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const { onNotInterested, onSave, onFavorite, onUndo, onOpenUrl } = handlersRef.current
      const key = e.key
      if (key === s.not_interested) onNotInterested?.()
      else if (key === s.save)      onSave?.()
      else if (key === s.favorite)  onFavorite?.()
      else if (key === s.undo)      onUndo?.()
      else if (key === s.open_url)  onOpenUrl?.()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts, enabled])  // handlers 제거 → ref로 처리
}
