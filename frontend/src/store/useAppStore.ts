import { create } from 'zustand'
import type { Job, SwipeAction } from '../types/job'

const SWIPE_SET_KEY = {
  not_interested: 'notInterestedUrls',
  save: 'savedUrls',
  favorite: 'favoriteUrls',
} as const

export type SourceFilter = '' | 'saramin' | 'jobkorea'

interface AppStore {
  screeningJobs: Job[]
  notInterestedUrls: Set<string>
  savedUrls: Set<string>
  favoriteUrls: Set<string>
  setScreeningData: (jobs: Job[], ni: string[], saved: string[], fav: string[]) => void
  applySwipe: (url: string, action: SwipeAction) => void
  revertSwipe: (url: string, action: SwipeAction) => void

  sourceFilter: SourceFilter
  setSourceFilter: (f: SourceFilter) => void

  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void

  crawling: boolean
  setCrawling: (v: boolean) => void

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
  setScreeningData: (jobs, ni, saved, fav) =>
    set({
      screeningJobs: jobs,
      notInterestedUrls: new Set(ni),
      savedUrls: new Set(saved),
      favoriteUrls: new Set(fav),
    }),

  applySwipe: (url, action) =>
    set((s) => {
      const key = SWIPE_SET_KEY[action]
      return { [key]: new Set(s[key]).add(url) }
    }),
  revertSwipe: (url, action) =>
    set((s) => {
      const key = SWIPE_SET_KEY[action]
      const next = new Set(s[key])
      next.delete(url)
      return { [key]: next }
    }),

  sourceFilter: '',
  setSourceFilter: (f) => set({ sourceFilter: f }),

  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  crawling: false,
  setCrawling: (v) => set({ crawling: v }),

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
