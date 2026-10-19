import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { getState, initStore, pomodoroTick, setUI, useStore } from '@/revamp/lib/store'
import { SettingsDialog } from '@/revamp/components/Settings'
import { Rail, TitleBar } from '@/revamp/components/Shell'
import { Toaster } from '@/revamp/components/Toast'
import { BugsView, JournalView, PlansView } from '@/revamp/components/Views'
import { DetailPane } from '@/revamp/components/Detail'
import { Segmented } from '@/revamp/components/ui'
import { MiniWidget } from '@/revamp/components/MiniWidget'
import { useViewport } from '@/revamp/lib/useNow'
import { getCurrentWindow } from '@tauri-apps/api/window'

const MORPH = { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 } as const

function useGlobalEffects() {
  const theme = useStore((s) => s.settings.theme)

  useEffect(() => {
    void initStore()
    document.documentElement.dataset.theme = theme
    const timer = setInterval(() => pomodoroTick(), 1000)
    const onKey = (e: KeyboardEvent) => {
      const s = getState()
      // Alt+Space / Alt+N / Alt+B 由原生全局快捷键负责，避免重复切换。
      if (e.altKey && e.code === 'KeyM') {
        e.preventDefault()
        setUI({ mode: s.ui.mode === 'full' ? 'mini' : 'full' })
      } else if (e.key === 'Escape' && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) {
        if (s.ui.settingsOpen) setUI({ settingsOpen: false })
        else if (s.ui.selected) setUI({ selected: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(timer); window.removeEventListener('keydown', onKey) }
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
}

function FullWindow({ width }: { width: number }) {
  const view = useStore((s) => s.ui.view)
  const selected = useStore((s) => s.ui.selected)
  const showRail = width >= 860
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      {!showRail && <div className="flex h-10 items-center border-b border-rule px-4"><Segmented size="sm" value={view} onChange={(v) => setUI({ view: v })} options={[{ value: 'plans', label: '计划' }, { value: 'bugs', label: 'BUG' }, { value: 'journal', label: '日志' }]} /></div>}
      <div className="relative flex min-h-0 flex-1">
        {showRail && <Rail />}
        <main className="relative min-w-0 flex-1">{view === 'plans' ? <PlansView /> : view === 'bugs' ? <BugsView /> : <JournalView />}</main>
        <AnimatePresence initial={false}>
          {selected && <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 420, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={MORPH} className={`shrink-0 overflow-hidden border-l border-rule bg-sheet ${width < 1200 ? 'absolute inset-y-0 right-0 z-20 shadow-pop' : ''}`}><div className="h-full w-[420px]"><DetailPane /></div></motion.aside>}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function DesktopRevampApp() {
  useGlobalEffects()
  const hidden = useStore((s) => s.ui.hidden)
  const mode = useStore((s) => s.ui.mode)
  const ready = useStore((s) => s.ready)
  const error = useStore((s) => s.error)
  const view = useStore((s) => s.ui.view)
  const viewport = useViewport()
  useEffect(() => {
    if (hidden) void getCurrentWindow().hide().then(() => setUI({ hidden: false }))
  }, [hidden])
  if (error) return <div className="grid h-full place-items-center bg-sheet p-6 text-center text-ink"><div><h1>数据库读取失败</h1><p className="mt-3 text-failed">{error}</p><button className="mt-4 underline" onClick={() => void initStore()}>重试</button></div></div>
  if (!ready) return <div className="grid h-full place-items-center bg-sheet text-ink">正在读取本机 SQLite…</div>
  return (
    <div className="desk relative h-full w-full overflow-hidden">
      <div className="absolute inset-2 overflow-hidden rounded-[14px] bg-sheet shadow-window">
        {mode === 'mini' ? <MiniWidget /> : <FullWindow width={viewport.w} />}
      </div>
      <span className="sr-only">当前视图：{view}</span>
      <SettingsDialog />
      <Toaster />
    </div>
  )
}
