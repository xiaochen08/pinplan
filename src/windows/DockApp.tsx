import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls, type Transition } from 'motion/react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import clsx from 'clsx'
import {
  emitOpenSettings,
  emitQuickAdd,
  onChanged,
  onCheckinPing,
  onPomodoro,
  onSettingsChanged,
} from '@/lib/bus'
import * as repo from '@/lib/repo'
import {
  SNAP_THRESHOLD,
  dockLoad,
  dockPlace,
  dockPlaceFree,
  type DockEdge,
  type DockMode,
  type DockSide,
} from '@/lib/dock'
import {
  TONE_COLOR,
  TONE_RHYTHM,
  deriveDockStatus,
  dockReminders,
  type DockStatus,
  type DockReminder,
} from '@/lib/status'
import { toggleMain } from '@/lib/window'
import { quitApp } from '@/lib/app'
import type { Bug, Plan, PomodoroSnapshot } from '@/lib/types'
import { Icon, type IconName } from '@/components/ui/Icon'

const IDLE_TUCK_MS = 6000
const BUBBLE_MS = 2600
/** 气泡里逐条轮播的间隔 */
const REMINDER_MS = 2400
const ICON = 38
/** 贴边小钉的过渡：响应快的弹簧。tween 会显得机械死板，弹簧才有"跟手"的收尾。 */
const SLIDE: Transition = { type: 'spring', stiffness: 620, damping: 34, mass: 0.55 }
/** 悬停多久才冒气泡（太长会显得迟钝） */
const BUBBLE_DELAY_MS = 220

const EMPTY_POMO: PomodoroSnapshot = {
  running: false,
  phase: 'work',
  remaining: 0,
  total: 0,
  completed: 0,
}

const MENU_ITEMS: { key: string; label: string; icon: IconName; danger?: boolean }[] = [
  { key: 'toggle', label: '显隐主窗', icon: 'expand' },
  { key: 'plan', label: '记一条计划', icon: 'plus' },
  { key: 'bug', label: '记一个 BUG', icon: 'bug' },
  { key: 'settings', label: '设置', icon: 'settings' },
  { key: 'quit', label: '退出 PinPlan', icon: 'x', danger: true },
]

/**
 * 边缘小钉。
 *
 * - 贴边时收起为 14px 细条，鼠标碰上去**平移滑出**成圆形图标（不缩放、不淡入）
 * - 拖到离边缘 90px 以内才吸附；拖到屏幕中间就自由悬浮，不再贴边
 * - 单击显隐主窗，右键出菜单，巡检到点轻微弹一下
 */
export function DockApp() {
  const [ready, setReady] = useState(false)
  const [edge, setEdge] = useState<DockEdge>('right')
  const [side, setSide] = useState<DockSide>('right')
  const [tucked, setTucked] = useState(true)
  const [bubble, setBubble] = useState<string | null>(null)
  /** 悬停时打开「逐条轮播」气泡 */
  const [bubbleOn, setBubbleOn] = useState(false)
  /** 轮播到的第几条 */
  const [ri, setRi] = useState(0)
  const [menu, setMenu] = useState(false)
  const [snapTick, setSnapTick] = useState(0)
  const [status, setStatus] = useState<DockStatus>(() => deriveDockStatus([], [], EMPTY_POMO))
  const [pomo, setPomo] = useState<PomodoroSnapshot>(EMPTY_POMO)
  const [reminders, setReminders] = useState<DockReminder[]>([])

  const offsetRef = useRef(-1)
  const freeRef = useRef({ x: 0, y: 0 })
  const placingRef = useRef(false)
  const dataRef = useRef<{ plans: Plan[]; bugs: Bug[] }>({ plans: [], bugs: [] })
  const pomoRef = useRef<PomodoroSnapshot>(EMPTY_POMO)
  const tuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enterAt = useRef(0)
  const prevTone = useRef<DockStatus['tone']>('idle')
  const statusRef = useRef(status)
  const edgeRef = useRef(edge)
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  statusRef.current = status
  edgeRef.current = edge

  const bounce = useAnimationControls()

  const isFree = edge === 'free'
  // 自由悬浮时没有边可收，永远保持展开
  const showBubble = bubble !== null || (bubbleOn && reminders.length > 0)
  const mode: DockMode = menu ? 'menu' : showBubble ? 'bubble' : tucked && !isFree ? 'tucked' : 'icon'
  const color = TONE_COLOR[status.tone]
  const rhythm = TONE_RHYTHM[status.tone]

  /* ---------------- 数据与状态 ---------------- */

  const recompute = useCallback(() => {
    setStatus(deriveDockStatus(dataRef.current.plans, dataRef.current.bugs, pomoRef.current))
    setReminders(dockReminders(dataRef.current.plans, dataRef.current.bugs))
  }, [])

  const reload = useCallback(async () => {
    const [plans, bugs] = await Promise.all([repo.listPlans(), repo.listBugs()])
    dataRef.current = { plans, bugs }
    recompute()
  }, [recompute])

  const flash = useCallback((text: string, ms = BUBBLE_MS) => {
    setBubble(text)
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setBubble(null), ms)
  }, [])

  /* 轮播：悬停气泡打开时，每 REMINDER_MS 换下一条 */
  useEffect(() => {
    if (!bubbleOn || bubble !== null || reminders.length <= 1) return
    const timer = setInterval(() => setRi((i) => (i + 1) % reminders.length), REMINDER_MS)
    return () => clearInterval(timer)
  }, [bubbleOn, bubble, reminders.length])

  /* 条目增删后，把游标夹回有效范围 */
  useEffect(() => {
    setRi((i) => (reminders.length === 0 ? 0 : i % reminders.length))
  }, [reminders.length])

  const armTuck = useCallback(() => {
    if (tuckTimer.current) clearTimeout(tuckTimer.current)
    tuckTimer.current = setTimeout(() => {
      if (edgeRef.current !== 'free') setTucked(true)
    }, IDLE_TUCK_MS)
  }, [])

  /* ---------------- 启动 ---------------- */

  useEffect(() => {
    let alive = true
    void (async () => {
      const [state, settings] = await Promise.all([dockLoad(), repo.loadSettings()])
      if (!alive) return
      document.documentElement.dataset.theme = settings.theme
      document.documentElement.dataset.accent = settings.accent
      setEdge(state.edge)
      offsetRef.current = state.offset
      freeRef.current = { x: state.x, y: state.y }
      await reload()
      if (state.edge === 'free') await dockPlaceFree(state.x, state.y, 'icon')
      else await dockPlace(state.edge, state.offset, 'tucked')
      if (!alive) return
      setReady(true)
      if (settings.dock_enabled) await getCurrentWindow().show()
    })()
    return () => {
      alive = false
    }
  }, [reload])

  /* ---------------- 几何同步 ---------------- */

  useEffect(() => {
    if (!ready) return
    let alive = true
    placingRef.current = true
    const call = isFree
      ? dockPlaceFree(freeRef.current.x, freeRef.current.y, mode)
      : dockPlace(edge, offsetRef.current, mode)
    void call.then((rect) => {
      if (!alive) return
      if (rect.edge === 'free') {
        freeRef.current = { x: rect.iconX ?? freeRef.current.x, y: rect.iconY ?? freeRef.current.y }
      } else {
        offsetRef.current = rect.offset
      }
      setSide(rect.side ?? 'right')
      setTimeout(() => {
        placingRef.current = false
      }, 400)
    })
    return () => {
      alive = false
    }
  }, [ready, edge, mode, snapTick, isFree])

  /* ---------------- 事件订阅 ---------------- */

  useEffect(() => {
    const subs: Promise<UnlistenFn>[] = [
      onChanged(() => void reload()),
      onPomodoro((snapshot) => {
        pomoRef.current = snapshot
        setPomo(snapshot)
        recompute()
      }),
      onCheckinPing(() => {
        setTucked(false)
        flash('该巡检了 · 点开看看', 3400)
        armTuck()
        void bounce.start({ y: [0, -5, 0], transition: { duration: 0.45, ease: 'easeOut' } })
      }),
      onSettingsChanged(async () => {
        const s = await repo.loadSettings()
        const win = getCurrentWindow()
        if (s.dock_enabled) await win.show()
        else await win.hide()
      }),
    ]
    return () => {
      void Promise.all(subs).then((fns) => fns.forEach((f) => f()))
    }
  }, [reload, recompute, flash, armTuck, bounce])

  /* ---------------- 状态翻转时冒一句 ---------------- */

  useEffect(() => {
    if (!ready) return
    const prev = prevTone.current
    if (prev === status.tone) return
    prevTone.current = status.tone
    if (status.tone === 'red' && prev !== 'idle') flash(status.headline, 3800)
    else if (status.tone === 'green' && (prev === 'blue' || prev === 'red')) flash('✓ 全部完成')
  }, [status.tone, status.headline, ready, flash])

  /* ---------------- 拖拽：近边吸附，远处自由 ---------------- */

  useEffect(() => {
    if (!ready) return
    let un: UnlistenFn | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    void getCurrentWindow()
      .onMoved(() => {
        if (placingRef.current) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(async () => {
          const win = getCurrentWindow()
          const [pos, size, scale, area] = await Promise.all([
            win.outerPosition(),
            win.outerSize(),
            win.scaleFactor(),
            invoke<{ x: number; y: number; w: number; h: number }>('monitor_work_area'),
          ])

          const cx = pos.x + size.width / 2
          const cy = pos.y + size.height / 2
          const dLeft = cx - area.x
          const dRight = area.x + area.w - cx
          const dTop = cy - area.y
          const nearest = Math.min(dLeft, dRight, dTop)

          setTucked(false)

          if (nearest <= SNAP_THRESHOLD * scale) {
            // 靠边：吸附
            const next: DockEdge =
              dLeft <= dRight && dLeft <= dTop ? 'left' : dRight <= dTop ? 'right' : 'top'
            offsetRef.current = next === 'top' ? pos.x : pos.y
            setEdge(next)
          } else {
            // 拖到中间：自由悬浮，停在原地
            freeRef.current = { x: pos.x, y: pos.y }
            setEdge('free')
          }
          setSnapTick((t) => t + 1)
          armTuck()
        }, 260)
      })
      .then((fn) => {
        un = fn
      })

    return () => {
      if (un) void un()
      if (timer) clearTimeout(timer)
    }
  }, [ready, armTuck])

  useEffect(
    () => () => {
      if (tuckTimer.current) clearTimeout(tuckTimer.current)
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    },
    [],
  )

  /* ---------------- 指针交互 ---------------- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    pressRef.current = { x: e.screenX, y: e.screenY }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pressRef.current
    if (!p) return
    if (Math.abs(e.screenX - p.x) + Math.abs(e.screenY - p.y) > 6) {
      pressRef.current = null
      void getCurrentWindow().startDragging()
    }
  }

  const onPointerUp = () => {
    if (!pressRef.current) return
    pressRef.current = null
    void toggleMain()
  }

  const onEnter = () => {
    enterAt.current = Date.now()
    if (tuckTimer.current) clearTimeout(tuckTimer.current)
    setTucked(false)
    if (menu) return
    // 只是路过就别打扰：悬停一会儿才冒气泡，然后逐条轮播
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      setRi(0)
      setBubbleOn(true)
    }, BUBBLE_DELAY_MS)
  }

  const onLeave = (e: React.MouseEvent) => {
    const { clientX: x, clientY: y } = e
    // 窗口尺寸变化时（气泡 ⇄ 菜单）WebView2 会上报错误的指针坐标，
    // 甚至报出比窗口还大的 clientX，从而误触 mouseleave 把刚打开的菜单关掉。
    // 两道护栏：坐标仍落在窗口附近（留 8px 容差），或刚进入 700ms 内 —— 都当误报。
    const near =
      x >= -8 && y >= -8 && x <= window.innerWidth + 8 && y <= window.innerHeight + 8
    if (near || Date.now() - enterAt.current < 700) return

    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setBubbleOn(false)
    setMenu(false)
    armTuck()
  }

  const runMenu = async (key: string) => {
    setMenu(false)
    if (key === 'toggle') await toggleMain()
    else if (key === 'plan') await emitQuickAdd('plan')
    else if (key === 'bug') await emitQuickAdd('bug')
    else if (key === 'settings') await emitOpenSettings()
    else if (key === 'quit') await quitApp()
  }

  /* ---------------- 渲染 ---------------- */

  const radius =
    edge === 'top' ? '0 0 9px 9px' : edge === 'left' ? '0 9px 9px 0' : '9px 0 0 9px'

  const tuckBar = (
    <motion.div
      key={`bar-${edge}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SLIDE}
      className="relative h-full w-full overflow-hidden"
      style={{ borderRadius: radius }}
    >
      {/* 收起的细条：比之前更亮，加一道白色内边，任何桌面背景上都能看见 */}
      <div
        className="h-full w-full"
        style={{
          borderRadius: radius,
          background: `linear-gradient(${edge === 'top' ? '180deg' : edge === 'left' ? '90deg' : '270deg'}, color-mix(in oklab, ${color} 82%, #fff), ${color} 55%, color-mix(in oklab, ${color} 68%, #000))`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,.32)`,
        }}
      />
      {/* 落位闪光：一次性，帮眼睛找到它收哪儿去了 */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white"
        style={{ borderRadius: radius }}
        initial={{ opacity: 0.45 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </motion.div>
  )

  // 滑出方向：贴右边缘就向右让出，贴左/上就反向。
  // 距离取 8px —— 正好是图标与窗口边缘的留白，滑动过程不会被裁切。
  const slideX = isFree ? 0 : edge === 'right' ? 8 : edge === 'left' ? -8 : 0
  const slideY = !isFree && edge === 'top' ? -8 : 0

  const icon = (
    <motion.div
      key="icon"
      initial={{ x: slideX, y: slideY }}
      animate={{ x: 0, y: 0 }}
      exit={{ x: slideX * 0.5, y: slideY * 0.5, transition: SLIDE }}
      transition={SLIDE}
      className="relative grid shrink-0 cursor-pointer place-items-center"
      style={{ width: ICON, height: ICON }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      title={`${status.headline}｜单击显隐主窗，拖动可换边`}
    >
      {/* 静态光晕：状态靠颜色表达，不做呼吸动画 */}
      {rhythm > 0 && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: color, filter: 'blur(7px)', opacity: 0.22 }}
        />
      )}

      {/* 玻璃底 + 状态描边 */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full border bg-ink-900/92"
        style={{ borderColor: `${color}66`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.16)` }}
      />

      {/* 番茄钟进度环 */}
      {pomo.running && pomo.total > 0 && (
        <svg className="pointer-events-none absolute -inset-[3px]" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20.5" fill="none" stroke="rgba(255,255,255,.13)" strokeWidth="2" />
          <motion.circle
            cx="22"
            cy="22"
            r="20.5"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
            strokeDasharray={2 * Math.PI * 20.5}
            animate={{ strokeDashoffset: 2 * Math.PI * 20.5 * (1 - pomo.remaining / pomo.total) }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </svg>
      )}

      <motion.div animate={bounce} className="relative">
        <Icon name={status.glyph} size={16} strokeWidth={2} style={{ color }} />
      </motion.div>

      {/* 数量角标 */}
      <AnimatePresence>
        {status.count > 0 && (
          <motion.span
            key={status.count}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SLIDE}
            className="tnum absolute -top-1 -right-1 grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 text-[9.5px] font-bold text-ink-950"
            style={{ background: color }}
          >
            {status.count > 99 ? '99+' : status.count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )

  // 面板朝哪边展开：图标在左 → 面板在右
  const iconFirst = isFree ? side === 'right' : edge !== 'right'
  const panelFrom = iconFirst ? -8 : 8

  /* 气泡内容：临时消息优先，否则显示轮播到的那一条 */
  const reminder = reminders[ri]
  const line1 = bubble ?? reminder?.label ?? status.headline
  const line2 = bubble ? status.detail : (reminder?.title ?? status.detail)
  const lineColor = bubble ? color : TONE_COLOR[reminder?.tone ?? status.tone]
  const rotKey = bubble !== null ? 'notice' : (reminder?.key ?? 'status')
  const rotCount = bubbleOn && bubble === null ? reminders.length : 0

  const bubbleEl = (
    <AnimatePresence>
      {showBubble && (
        <motion.div
          key="bubble"
          initial={{ opacity: 0, x: panelFrom }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, transition: SLIDE }}
          transition={SLIDE}
          className="pointer-events-none relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-[11px] border border-tint-12 bg-ink-900/96 px-2.5 py-1.5"
          style={{ maxWidth: 200 }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={rotKey}
              initial={{ y: 9, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -9, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.3, 1] }}
              className={clsx('flex min-w-0 flex-col', rotCount > 1 && 'pr-7')}
            >
              <div
                className="truncate text-[11.5px] leading-tight font-medium"
                style={{ color: lineColor }}
              >
                {line1}
              </div>
              <div className="truncate text-[10px] leading-tight text-ink-400">{line2}</div>
            </motion.div>
          </AnimatePresence>
          {rotCount > 1 && (
            <span className="tnum absolute top-1 right-1.5 text-[9px] leading-none text-ink-500">
              {ri + 1}/{rotCount}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  const menuEl = (
    <motion.div
      key="menu"
      initial={{ opacity: 0, x: panelFrom }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: SLIDE }}
      transition={SLIDE}
      className="w-[168px] shrink-0 rounded-[12px] border border-tint-10 bg-ink-900/95 p-1 shadow-[0_14px_34px_-10px_rgba(0,0,0,.75)]"
    >
      {MENU_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => void runMenu(item.key)}
          className={clsx(
            'flex h-7 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[12px] transition-colors duration-120',
            item.danger
              ? 'text-[var(--color-failed)] hover:bg-[var(--color-failed)]/14'
              : 'text-ink-200 hover:bg-tint-10',
          )}
        >
          <Icon name={item.icon} size={13} />
          {item.label}
        </button>
      ))}
    </motion.div>
  )

  const panel = mode === 'menu' ? menuEl : bubbleEl
  const menuBelow = mode === 'menu' && edge === 'top'

  return (
    <div
      className="h-full w-full"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu((v) => !v)
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'tucked' ? (
          tuckBar
        ) : menuBelow ? (
          <motion.div
            key="column"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: SLIDE }}
            transition={SLIDE}
            className="flex h-full w-full flex-col items-start px-2"
          >
            <div className="flex h-[56px] shrink-0 items-center">{icon}</div>
            {menuEl}
          </motion.div>
        ) : (
          <motion.div
            key="row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: SLIDE }}
            transition={SLIDE}
            className="flex h-full w-full items-center gap-2 px-2"
            style={{ justifyContent: isFree ? 'flex-start' : edge === 'right' ? 'flex-end' : 'flex-start' }}
          >
            {iconFirst ? (
              <>
                {icon}
                {panel}
              </>
            ) : (
              <>
                {panel}
                {icon}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
