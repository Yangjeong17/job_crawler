export interface Job {
  url: string
  title: string
  company: string
  source: string
  location: string
  experience: string
  education: string
  salary: string
  tech_stack: string[]
  categories: string[]
  job_type: string
  deadline: string
  deadline_date: string
  posted_date: string
  description: string
  crawled_at: string
  job_id: string
  is_modified: boolean
}

export type SwipeAction = 'not_interested' | 'save' | 'favorite'
export type ReassignFrom = 'ni' | 'saved' | 'favorite'
export type ReassignTo   = 'ni' | 'saved' | 'favorite'

export interface Shortcuts {
  not_interested: string
  save: string
  favorite: string
  undo: string
  open_url: string
}

export interface SearchHistory {
  keyword: string
  count: number
  last_crawled: string
}

export interface Stats {
  total: number
}
