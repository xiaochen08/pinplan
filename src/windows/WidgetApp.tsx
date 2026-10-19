import { useEffect, useRef } from 'react'
import {
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  getCurrentWindow,
} from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { emitPomodoro, onChanged, onOpenSettings, onQuickAdd } from '@/lib/bus'
import { setGlassMode } from '@/lib/glass'
import { DesktopRevampApp } from '@/revamp/App'
import { focusQuickAdd, getState, refreshFromDb, setUI, useStore } from '@/revamp/lib/store'
import '@/revamp/index.css'

const WIDE = { w: 960, h: 640 }

/** 主窗容器：保留 Tauri 的窗口生命周期，把 Figma Make 界面作为内容渲染。 */
export function WidgetApp() {
  const alwaysOnTop = useStore((s) => s.settings.alwaysOnTop)
  const accent = useStore((s) => s.settings.accent)
  const glass = useStore((s) => s.settings.glass)
  const theme = useStore((s) => s.settings.theme)
  const mode = useStore((s) => s.ui.mode)
  const fullSize = useRef(new LogicalSize(WIDE.w, WIDE.h))

  useEffect(() => {
    void setGlassMode(theme === 'paper' ? 'none' : glass)
  }, [glass, theme])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
    document.documentElement.dataset.glass = glass
  }, [accent, glass])

  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(alwaysOnTop)
  }, [alwaysOnTop])

  useEffect(() => {
    const subs: Promise<UnlistenFn>[] = [
      onChanged(() => { void refreshFromDb().catch(console.error) }),
      onQuickAdd((kind) => {
        focusQuickAdd(kind === 'bug' ? 'bugs' : 'plans')
        void getCurrentWindow().show().then(() => getCurrentWindow().setFocus())
      }),
      onOpenSettings(() => {
        setUI({ settingsOpen: true, hidden: false })
        void getCurrentWindow().show().then(() => getCurrentWindow().setFocus())
      }),
    ]
    return () => { void Promise.all(subs).then((fns) => fns.forEach((f) => f())) }
  }, [])

  useEffect(() => {
    const win = getCurrentWindow()
    let cancelled = false
    const resize = async () => {
      if (mode === 'mini') {
        const size = await win.innerSize()
        fullSize.current = size.toLogical(await win.scaleFactor())
        if (cancelled) return
        await win.setMinSize(new LogicalSize(340, 420))
        await win.setSize(new LogicalSize(360, 520))
      } else {
        await win.setMinSize(new LogicalSize(780, 540))
        if (!cancelled) await win.setSize(fullSize.current)
      }
    }
    void resize()
    return () => { cancelled = true }
  }, [mode])

  useEffect(() => {
    const timer = setInterval(() => void emitPomodoro(getState().pomodoro), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const win = getCurrentWindow()
      await win.setMinSize(new LogicalSize(780, 540))
      await win.setSize(new LogicalSize(WIDE.w, WIDE.h))
      const [scale, monitor, pos] = await Promise.all([win.scaleFactor(), currentMonitor(), win.outerPosition()])
      if (!monitor || cancelled) return
      const pw = WIDE.w * scale
      const ph = WIDE.h * scale
      const maxX = Math.max(monitor.position.x, monitor.position.x + monitor.size.width - pw)
      const maxY = Math.max(monitor.position.y, monitor.position.y + monitor.size.height - ph)
      await win.setPosition(new PhysicalPosition(
        Math.round(Math.min(Math.max(pos.x, monitor.position.x), maxX)),
        Math.round(Math.min(Math.max(pos.y, monitor.position.y), maxY)),
      ))
    }
    void run()
    return () => { cancelled = true }
  }, [])

  return <DesktopRevampApp />
}
