import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TabBar } from './components/layout/TabBar'
import { ShortcutModal } from './components/ui/ShortcutModal'
import { ScreeningPage } from './pages/ScreeningPage'
import { AllJobsPage } from './pages/AllJobsPage'
import { JobListPage } from './pages/JobListPage'
import { SchedulerPage } from './pages/SchedulerPage'
import { GuidePage } from './pages/GuidePage'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const { toast, clearToast } = useAppStore()

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--background)' }}>
      <Sidebar />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%' }}>
        <TabBar onShortcutOpen={() => setShortcutOpen(true)} />

        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/screening" replace />} />
            <Route path="/screening"      element={<ScreeningPage />} />
            <Route path="/all"            element={<AllJobsPage />} />
            <Route path="/not-interested" element={<JobListPage mode="not-interested" />} />
            <Route path="/saved"          element={<JobListPage mode="saved" />} />
            <Route path="/favorites"      element={<JobListPage mode="favorites" />} />
            <Route path="/scheduler"      element={<SchedulerPage />} />
            <Route path="/guide"          element={<GuidePage />} />
          </Routes>
        </div>
      </div>

      <ShortcutModal open={shortcutOpen} onClose={() => setShortcutOpen(false)} />

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl text-sm font-medium shadow-2xl z-50 cursor-pointer"
          style={{ padding: '12px 20px', background: 'var(--foreground)', color: 'var(--background)' }}
          onClick={clearToast}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
