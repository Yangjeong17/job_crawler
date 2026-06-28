import type { Job, SwipeAction, ReassignFrom, ReassignTo, Shortcuts } from '../types/job'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  stats: () => get<{ total: number }>('/stats'),

  jobs: {
    search: () => get<{ jobs: Job[]; not_interested_urls: string[]; saved_urls: string[]; favorite_urls: string[] }>('/jobs/search'),
    all:    () => get<{ jobs: Job[] }>('/jobs/all'),
    notInterested: () => get<{ jobs: Job[] }>('/jobs/not-interested'),
    saved:     () => get<{ jobs: Job[] }>('/jobs/saved'),
    favorites: () => get<{ jobs: Job[] }>('/jobs/favorites'),

    swipe: (url: string, action: SwipeAction) =>
      post('/jobs/swipe', { url, action }),

    undo: () => post<{ ok: boolean; url: string; action: string }>('/jobs/undo'),

    reassign: (url: string, from_status: ReassignFrom, to_status: ReassignTo) =>
      post('/jobs/reassign', { url, from_status, to_status }),
  },

  analyze: (url: string) =>
    post<{ result: string }>('/analyze', { url }),

  shortcuts: {
    get: () => get<Shortcuts>('/shortcuts'),
    save: (data: Shortcuts) => put('/shortcuts', data),
  },

  searchHistory: () => get<{ history: { keyword: string; count: number; last_crawled: string }[] }>('/search-history'),
  dbFiles:       () => get<{ files: string[] }>('/db-files'),
  migrate:       (db_name: string) => post('/migrate', { db_name }),
}

export function createCrawlSocket(
  keyword: string,
  saramin: boolean,
  jobkorea: boolean,
  onMessage: (msg: CrawlMessage) => void,
) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${location.host}/api/crawl`)
  ws.onopen = () => ws.send(JSON.stringify({ keyword, saramin, jobkorea }))
  ws.onmessage = (e) => onMessage(JSON.parse(e.data))
  return ws
}

export type CrawlMessage =
  | { type: 'progress'; step: number; total: number; message: string }
  | { type: 'done'; total: number; filtered: number; jobs: Job[] }
  | { type: 'error'; message: string }
