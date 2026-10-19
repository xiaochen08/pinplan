import { AppWindow, Bug, Check, Crosshair, EyeOff, Maximize2, Minimize2, Pin, Plus, Radar, Settings2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { focusQuickAdd, getState, setUI, triggerCheckin, useStore } from '@/revamp/lib/store'
import { TONE_COLOR, TONE_RHYTHM, dockStatus, reminders } from '@/revamp/lib/dock'
import { useViewport } from '@/revamp/lib/useNow'
import { cx } from './ui'

const SPRING = { type: 'spring', stiffness: 420, damping: 30 } as const

/** 边缘小钉 — a 14px breathing strip that slides out into a status coin. */
export function EdgePin() {
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  const pomo = useStore((s) => s.pomodoro)
  const hidden = useStore((s) => s.ui.hidden)
  const mode = useStore((s) => s.ui.mode)
  const checkin = useStore((s) => s.ui.checkin)
  const pinY = useStore((s) => s.ui.pinY)
  const { h: vh } = useViewport()

  const status = useMemo(() => dockStatus(plans, bugs, pomo), [plans, bugs, pomo])
  const list = useMemo(() => reminders(plans, bugs), [plans, bugs])
  const tone = TONE_COLOR[status.tone]

  const [hover, setHover] = useState(false)
  const [bubble, setBubble] = useState(false)
  const [idx, setIdx] = useState(0)
  const [menu, setMenu] = useState(false)
  const [dragY, setDragY] = useState<number | null>(null)
  const drag = useRef<{ start: number; origin: number; moved: boolean } | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const expanded = hover || menu || !!checkin || dragY !== null
  const y = dragY ?? pinY * vh

  // Bubble appears after a 400ms dwell, then rotates through reminders.
  useEffect(() => {
    if (!hover || menu) {
      setBubble(false)
      return
    }
    const t = setTimeout(() => setBubble(true), 400)
    return () => clearTimeout(t)
  }, [hover, menu])

  useEffect(() => {
    if (!bubble || list.length < 2) return
    const t = setInterval(() => setIdx((i) => i + 1), 3200)
    return () => clearInterval(t)
  }, [bubble, list.length])

  const current = list.length ? list[idx % list.length] : null

  const enter = () => {
    clearTimeout(leaveTimer.current)
    setHover(true)
  }
  const leave = () => {
    leaveTimer.current = setTimeout(() => setHover(false), 280)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    drag.current = { start: e.clientY, origin: y, moved: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.start
    if (!d.moved && Math.abs(dy) < 4) return
    d.moved = true
    setDragY(Math.min(vh - 60, Math.max(40, d.origin + dy)))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.moved) {
      if (dragY !== null) setUI({ pinY: dragY / vh })
      setDragY(null)
      return
    }
    setUI({ hidden: !getState().ui.hidden })
  }

  const Icon: LucideIcon =
    status.tone === 'red' ? (status.headline.includes('BUG') ? Bug : Crosshair) : status.tone === 'green' ? Check : status.tone === 'blue' ? Crosshair : Pin

  const r = 25
  const c = 2 * Math.PI * r
  const progress = pomo.total ? 1 - pomo.remaining / pomo.total : 0

  return (
    <div
      className="pointer-events-none fixed right-0 z-40 h-14 w-[80px]"
      style={{ top: y - 28 }}
      onMouseOver={enter}
      onMouseOut={leave}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu(true)
      }}
    >
      {/* Collapsed strip */}
      <motion.div
        className="pointer-events-auto absolute top-[4px] right-0 grid h-12 w-[14px] cursor-pointer place-items-center"
        animate={{ x: expanded ? 14 : 0, opacity: expanded ? 0 : 1 }}
        transition={SPRING}
      >
        <span
          className={cx('h-9 w-[4px] rounded-full', TONE_RHYTHM[status.tone] > 0 && 'breathe')}
          style={{ background: tone, ['--rhythm' as string]: `${TONE_RHYTHM[status.tone]}s`, boxShadow: `0 0 10px ${tone}` }}
        />
      </motion.div>

      {/* Coin */}
      <motion.div
        className="pointer-events-auto absolute top-0 left-2 h-14 w-14"
        initial={false}
        animate={{ x: expanded ? 0 : 80 }}
        transition={SPRING}
      >
        <button
          type="button"
          aria-label={hidden ? '显示 PinPlan' : '隐藏 PinPlan'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={cx('absolute inset-0 grid touch-none place-items-center rounded-full bg-sheet shadow-pop', dragY !== null ? 'cursor-grabbing' : 'cursor-pointer')}
        >
          {checkin && <span className="ripple absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px ${tone}` }} />}
          <svg width="56" height="56" className="absolute inset-0 -rotate-90">
            <circle cx="28" cy="28" r={r} fill="none" stroke="var(--rule)" strokeWidth="2" />
            {pomo.running && (
              <circle cx="28" cy="28" r={r} fill="none" stroke={pomo.phase === 'work' ? 'var(--seal)' : 'var(--s-done)'} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
            )}
          </svg>
          <span className="relative grid h-9 w-9 place-items-center rounded-full" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}>
            <Icon size={17} strokeWidth={2} />
          </span>
          {status.count > 0 && (
            <span className="absolute -top-0.5 -left-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 border-sheet px-1 font-mono text-[10px] font-semibold text-white" style={{ background: tone }}>
              {status.count}
            </span>
          )}
        </button>
      </motion.div>

      {/* Bubble */}
      <AnimatePresence>
        {(bubble || checkin) && !menu && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute top-1.5 right-[80px] w-[236px] rounded-[10px] bg-sheet px-3 py-2.5 shadow-pop"
          >
            {checkin ? (
              <>
                <div className="font-mono text-[10px] tracking-[0.1em] text-seal">CHECK-IN</div>
                <div className="mt-0.5 text-[13px] font-medium">该巡检了</div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.06em]">
                  <span style={{ color: TONE_COLOR[current?.tone ?? status.tone] }}>{current?.label ?? status.headline}</span>
                  {list.length > 1 && <span className="text-ink-4">{(idx % list.length) + 1}/{list.length}</span>}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={current?.key ?? 'status'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="mt-0.5 truncate text-[13px] font-medium">
                    {current?.title ?? status.detail}
                  </motion.div>
                </AnimatePresence>
                {pomo.running && <div className="mt-1.5 border-t border-rule pt-1.5 font-mono text-[10.5px] text-ink-3">{status.tone === 'blue' ? status.headline : `${pomo.phase === 'work' ? '专注中' : '休息中'}`}</div>}
                <div className="mt-1.5 text-[10.5px] text-ink-4">单击{hidden ? '唤回' : '隐藏'} · 右键菜单 · 上下拖动</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context menu */}
      <AnimatePresence>
        {menu && <PinMenu hidden={hidden} mode={mode} onClose={() => setMenu(false)} />}
      </AnimatePresence>
    </div>
  )
}

function PinMenu({ hidden, mode, onClose }: { hidden: boolean; mode: 'full' | 'mini'; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', on)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', on)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const items: { icon: LucideIcon; label: string; kbd?: string; fn: () => void; sep?: boolean }[] = [
    { icon: hidden ? AppWindow : EyeOff, label: hidden ? '显示主窗' : '隐藏主窗', kbd: 'Alt Space', fn: () => setUI({ hidden: !hidden }) },
    { icon: mode === 'full' ? Minimize2 : Maximize2, label: mode === 'full' ? '切换到小窗' : '展开主窗', fn: () => setUI({ mode: mode === 'full' ? 'mini' : 'full', hidden: false }) },
    { icon: Plus, label: '记一条计划', kbd: 'Alt N', fn: () => focusQuickAdd('plans'), sep: true },
    { icon: Bug, label: '记一个 BUG', kbd: 'Alt B', fn: () => focusQuickAdd('bugs') },
    { icon: Radar, label: '现在巡检', fn: () => triggerCheckin(true) },
    { icon: Settings2, label: '设置', fn: () => setUI({ settingsOpen: true, hidden: false }), sep: true },
  ]
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96, x: 6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      className="pointer-events-auto absolute top-0 right-[84px] w-[208px] origin-top-right rounded-[10px] bg-sheet p-1 shadow-pop"
    >
      {items.map((it) => (
        <div key={it.label}>
          {it.sep && <div className="mx-2 my-1 h-px bg-rule" />}
          <button type="button" onClick={run(it.fn)} className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-[12.5px] text-ink-2 hover:bg-sheet-3 hover:text-ink">
            <it.icon size={14} strokeWidth={1.7} />
            {it.label}
            {it.kbd && <span className="ml-auto font-mono text-[10px] text-ink-4">{it.kbd}</span>}
          </button>
        </div>
      ))}
    </motion.div>
  )
}
