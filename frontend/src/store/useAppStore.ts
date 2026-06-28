import { create } from 'zustand'
import type { Job } from '../types/job'

export type SourceFilter = '' | 'saramin' | 'jobkorea'

interface AppStore {
  screeningJobs: Job[]
  notInterestedUrls: Set<string>
  savedUrls: Set<string>
  favoriteUrls: Set<string>
  setScreeningData: (jobs: Job[], ni: string[], saved: string[], fav: string[]) => void

  currentCardIndex: number
  advanceCard: () => void
  undoCard: () => void

  sourceFilter: SourceFilter
  setSourceFilter: (f: SourceFilter) => void

  crawlLog: string[]
  addCrawlLog: (msg: string) => void
  clearCrawlLog: () => void

  toast: string | null
  showToast: (msg: string) => void
  clearToast: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  screeningJobs: [],
  notInterestedUrls: new Set(),
  savedUrls: new Set(),
  favoriteUrls: new Set(),
  // 새 데이터 로드 시 카드 인덱스 리셋
  setScreeningData: (jobs, ni, saved, fav) =>
    set({
      screeningJobs: jobs,
      notInterestedUrls: new Set(ni),
      savedUrls: new Set(saved),
      favoriteUrls: new Set(fav),
      currentCardIndex: 0,
    }),

  currentCardIndex: 0,
  advanceCard: () => set((s) => ({ currentCardIndex: s.currentCardIndex + 1 })),
  undoCard:    () => set((s) => ({ currentCardIndex: Math.max(0, s.currentCardIndex - 1) })),

  sourceFilter: '',
  setSourceFilter: (f) => set({ sourceFilter: f }),

  crawlLog: [],
  addCrawlLog: (msg) => set((s) => ({ crawlLog: [...s.crawlLog, msg] })),
  clearCrawlLog: () => set({ crawlLog: [] }),

  toast: null,
  showToast: (msg) => {
    set({ toast: msg })
    setTimeout(() => set({ toast: null }), 3000)
  },
  clearToast: () => set({ toast: null }),
}))
