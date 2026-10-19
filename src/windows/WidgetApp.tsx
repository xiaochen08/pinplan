import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  getCurrentWindow,
} from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { refreshSoon, useStore } from '@/store/useStore'
import { onChanged, onOpenSettings, onQuickAdd, emitPomodoro } from '@/lib/bus'
import { useNow } from '@/lib/useNow'
import { Header } from '@/components/Header'
import { PomodoroBar } from '@/components/PomodoroBar'
import { ListView } from '@/components/ListView'
import { BoardView } from '@/components/BoardView'
import { QuickAdd } from '@/components/QuickAdd'
import { Sidebar } from '@/components/Sidebar'
import { DetailPanel } from '@/components/DetailPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { IconButton, Notice, Segmented, TextField } from '@/components/ui/primitives'
import { slideDir } from '@/components/ui/motion'
import { setGlassMode } from '@/lib/glass'

const WIDE = { w: 960, h: 640 }

export function WidgetApp() {
  const ready = useStore((s) => s.ready)
  const error = useStore((s) => s.error)
  const notice = useStore((s) => s.notice)
  const accent = useStore((s) => s.settings.accent)
  const glass = useStore((s) => s.settings.glass)
  const theme = useStore((s) => s.settings.theme)
  const alwaysOnTop = useStore((s) => s.settings.always_on_top)
  const select = useStore((s) => s.select)

  const [pulse, setPulse] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const now = useNow(30_000)

  /* ---------------- 启动 ---------------- */

  useEffect(() => {
    void useStore.getState().init()

    const subs: Promise<UnlistenFn>[] = [
      onChanged(() => {
        refreshSoon()
        setRefreshKey((k) => k + 1)
      }),
      onQuickAdd((kind) => {
        const s = useStore.getState()
        const win = getCurrentWindow()
        s.setTab(kind === 'bug' ? 'bug' : 'plan')
        setPulse((p) => p + 1)
        void win.show().then(() => win.setFocus())
      }),
      onOpenSettings(() => {
        const win = getCurrentWindow()
        useStore.getState().openSettings(true)
        void win.show().then(() => win.setFocus())
      }),
    ]

    return () => {
      void Promise.all(subs).then((fns) => fns.forEach((f) => f()))
    }
  }, [])

  /* ---------------- 番茄钟节拍 ---------------- */

  useEffect(() => {
    const timer = setInterval(() => {
      const store = useStore.getState()
      store.tick()
      // 每秒把番茄钟快照广播给边缘小钉（用于画进度环与状态色）
      void emitPomodoro(useStore.getState().pomodoro)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  /* ---------------- 强调色 ---------------- */

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  /* ---------------- 置顶 ----------------
     tauri.conf 里虽然写了 alwaysOnTop，但窗口-vibrancy 改窗口样式时会把
     WS_EX_TOPMOST 弄丢，结果窗口被别的窗口盖住 —— 右上角的按钮就点不到了。
     这里每次启动/改设置都重新压一次。 */

  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(alwaysOnTop)
  }, [alwaysOnTop])

  /* ---------------- 主题 ---------------- */

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  /* ---------------- 玻璃模式（关闭系统模糊时改用实底） ---------------- */

  useEffect(() => {
    document.documentElement.dataset.glass = glass
  }, [glass])

  /* ---------------- 玻璃底（读到设置后校正一次） ----------------
     Swiss 是纸面，整窗实底，系统模糊只会白费合成 —— 强制关掉。 */

  useEffect(() => {
    void setGlassMode(theme === 'swiss' ? 'none' : glass)
  }, [glass, theme])

  /* ---------------- 窗口尺寸 ----------------
     只有一种形态：展开的大窗。启动时校正一次大小，并把窗口夹回屏幕内。 */

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const win = getCurrentWindow()

      await win.setMinSize(new LogicalSize(780, 540))
      await win.setSize(new LogicalSize(WIDE.w, WIDE.h))

      const scale = await win.scaleFactor()
      const monitor = await currentMonitor()
      const pos = await win.outerPosition()
      if (monitor && !cancelled) {
        const pw = WIDE.w * scale
        const ph = WIDE.h * scale
        const maxX = Math.max(monitor.position.x, monitor.position.x + monitor.size.width - pw)
        const maxY = Math.max(monitor.position.y, monitor.position.y + monitor.size.height - ph)
        const x = Math.min(Math.max(pos.x, monitor.position.x), maxX)
        const y = Math.min(Math.max(pos.y, monitor.position.y), maxY)
        await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <Shell>
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <div className="mb-1 text-[13px] font-medium text-[var(--color-failed)]">
              数据初始化失败
            </div>
            <div className="text-[11.5px] leading-relaxed text-ink-400">{error}</div>
          </div>
        </div>
      </Shell>
    )
  }

  if (!ready) {
    return (
      <Shell>
        <div className="grid h-full place-items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex h-full flex-col">
        <Header />
        <PomodoroBar compact />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Toolbar />
            <div className="min-h-0 flex-1 overflow-hidden">
              <WideBody
                now={now}
                refreshKey={refreshKey}
                onOpenPlan={(id) => select({ entity: 'plan', id })}
                onOpenBug={(id) => select({ entity: 'bug', id })}
              />
            </div>
            <QuickAdd pulse={pulse} />
          </div>
          <AnimatePresence>
            <DetailSlot refreshKey={refreshKey} />
          </AnimatePresence>
        </div>
      </div>

      <SettingsPanel />
      <Notice notice={notice} />
    </Shell>
  )
}

/* ------------------------------------------------------------------
   外壳：透明窗口 + 玻璃面板
   ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full">
      <div
        className="glass glass-window absolute inset-0 flex flex-col overflow-hidden"
        style={{ borderRadius: 14 }}
      >
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   工具条
   ------------------------------------------------------------------ */

function Toolbar() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const planTotal = useStore((s) => s.plans.length)
  const bugTotal = useStore((s) => s.bugs.length)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="px-2.5 pb-2">
      <div className="flex items-center gap-1.5">
        <Segmented
          layoutId="tab-indicator"
          value={tab}
          onChange={(v) => setTab(v)}
          className="w-[240px]"
          options={[
            { value: 'plan', label: '计划', badge: planTotal },
            { value: 'bug', label: 'BUG', badge: bugTotal },
          ]}
        />

        <IconButton
          icon="search"
          label="搜索"
          active={searchOpen}
          onClick={() => {
            setSearchOpen((v) => !v)
            if (searchOpen) setQuery('')
          }}
        />

        <IconButton
          icon={view === 'list' ? 'board' : 'list'}
          label={view === 'list' ? '切换到看板' : '切换到列表'}
          onClick={() => setView(view === 'list' ? 'board' : 'list')}
        />
      </div>

      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.3, 0.8, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1.5">
              <TextField
                icon="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜标题、备注、复盘…"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQuery('')
                    setSearchOpen(false)
                  }
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------
   过滤后的数据
   ------------------------------------------------------------------ */

function useFiltered() {
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  const query = useStore((s) => s.query)
  const planFilter = useStore((s) => s.planFilter)
  const bugFilter = useStore((s) => s.bugFilter)

  return useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (...fields: (string | null | undefined)[]) =>
      !q || fields.some((f) => (f ?? '').toLowerCase().includes(q))

    return {
      plans: plans.filter(
        (p) =>
          (planFilter === 'all' || p.status === planFilter) &&
          hit(p.title, p.detail, p.lesson, p.expect, p.result),
      ),
      bugs: bugs.filter(
        (b) => (bugFilter === 'all' || b.status === bugFilter) && hit(b.title, b.repro, b.fix_note),
      ),
    }
  }, [plans, bugs, query, planFilter, bugFilter])
}

/* ------------------------------------------------------------------
   主体
   ------------------------------------------------------------------ */
function WideBody({
  now,
  refreshKey,
  onOpenPlan,
  onOpenBug,
}: {
  now: number
  refreshKey: number
  onOpenPlan: (id: number) => void
  onOpenBug: (id: number) => void
}) {
  const { plans, bugs } = useFiltered()
  const view = useStore((s) => s.view)
  const tab = useStore((s) => s.tab)
  const planFilter = useStore((s) => s.planFilter)
  const dir = tab === 'bug' ? 1 : -1

  if (tab === 'plan' && view === 'board') {
    return <BoardView plans={plans} now={now} onOpen={onOpenPlan} />
  }

  return (
    <div className="scroll h-full overflow-x-hidden px-3 pb-3">
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={tab}
          custom={dir}
          variants={slideDir}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <ListView
            plans={plans}
            bugs={bugs}
            now={now}
            filtered={tab === 'plan' ? planFilter !== 'all' : false}
            onOpenPlan={onOpenPlan}
            onOpenBug={onOpenBug}
            key={refreshKey}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function DetailSlot({ refreshKey }: { refreshKey: number }) {
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  if (!selected) return null
  return (
    <DetailPanel
      key={`${selected.entity}-${selected.id}`}
      sel={selected}
      refreshKey={refreshKey}
      onClose={() => select(null)}
    />
  )
}
