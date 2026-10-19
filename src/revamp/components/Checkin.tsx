import { Check, PauseCircle, Play, Radar, X, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { answerCheckin, checkinStreak, dismissCheckin, getState, useStore } from '@/revamp/lib/store'
import type { CheckinAnswer } from '@/revamp/lib/types'
import { ago, duration } from '@/revamp/lib/time'
import { Glyph, IconBtn, Kbd, cx } from './ui'

const AUTO_CLOSE = 22_000

/** 巡检弹窗 — the highest-frequency interaction; must be answerable in one second. */
export function Checkin() {
  const planId = useStore((s) => s.ui.checkin)
  const plans = useStore((s) => s.plans)
  const plan = plans.find((p) => p.id === planId) ?? null
  return <AnimatePresence>{plan && <Card key={plan.id} planId={plan.id} />}</AnimatePresence>
}

function Card({ planId }: { planId: number }) {
  const plan = useStore((s) => s.plans.find((p) => p.id === planId))!
  const [note, setNote] = useState('')
  const [paused, setPaused] = useState(false)
  const remaining = useRef(AUTO_CLOSE)
  const startedAt = useRef(Date.now())
  const streak = checkinStreak(planId, getState())
  const parkMode = streak >= 2

  // Auto-dismiss after 22s; hovering or typing pauses the countdown.
  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const t = setTimeout(dismissCheckin, remaining.current)
    return () => {
      clearTimeout(t)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused])

  const options: { key: CheckinAnswer; label: string; tone: string; icon: LucideIcon }[] = [
    { key: 'still', label: '还在做', tone: 'var(--s-doing)', icon: Play },
    parkMode
      ? { key: 'park', label: '先搁置', tone: 'var(--s-parked)', icon: PauseCircle }
      : { key: 'stuck', label: '卡住了', tone: 'var(--s-parked)', icon: Zap },
    { key: 'done', label: '已完成', tone: 'var(--s-done)', icon: Check },
    { key: 'drop', label: '放弃', tone: 'var(--s-dropped)', icon: X },
  ]

  const answer = (k: CheckinAnswer) => answerCheckin(planId, k, note)

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).tagName === 'INPUT'
      if (e.key === 'Escape') dismissCheckin()
      if (!typing && /^[1-4]$/.test(e.key)) answer(options[Number(e.key) - 1].key)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const elapsed = plan.started_at ? duration(Date.now() - new Date(plan.started_at).getTime()) : '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(note.length > 0)}
      className="fixed right-[44px] bottom-6 z-50 w-[384px] overflow-hidden rounded-[13px] bg-sheet shadow-pop"
      role="dialog"
      aria-label="巡检"
    >
      <span
        className="absolute top-0 left-0 h-[2px] w-full origin-left bg-seal"
        style={{ animation: `countdown ${AUTO_CLOSE}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
      />
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <Radar size={14} className="text-seal" />
        <span className="font-mono text-[10px] tracking-[0.16em] text-ink-3">CHECK-IN · 巡检</span>
        <IconBtn icon={X} label="稍后再问 (Esc)" size={14} className="-mr-1.5 ml-auto" onClick={dismissCheckin} />
      </div>
      <div className="px-4 pt-1">
        <h2 className="font-cn text-[19px] font-semibold">这条还在推进吗？</h2>
        <div className="mt-2 flex items-start gap-2 rounded-[8px] bg-sheet-2 px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--rule)]">
          <Glyph status={plan.status} size={15} className="mt-[2px]" />
          <div className="min-w-0">
            <div className="text-[13.5px] leading-snug font-medium">{plan.title}</div>
            <div className="mt-1 font-mono text-[10.5px] text-ink-4">
              已进行 {elapsed} · 上次动静 {ago(plan.updated_at)}
            </div>
          </div>
        </div>
        {parkMode && (
          <p className="mt-2 text-[11.5px] text-parked">已经连续 {streak} 次说「还在做」了，要不要先搁置？</p>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5 px-4 pt-3">
        {options.map((o, i) => (
          <button
            key={o.key}
            type="button"
            onClick={() => answer(o.key)}
            className={cx(
              'group relative flex h-[62px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[9px] text-[12px] font-medium transition-[transform,background-color] active:scale-[0.96]',
            )}
            style={{ color: o.tone, background: `color-mix(in oklab, ${o.tone} 9%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${o.tone} 24%, transparent)` }}
          >
            <o.icon size={16} strokeWidth={1.9} />
            {o.label}
            <span className="absolute top-1 right-1.5 font-mono text-[9px] opacity-50">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="mx-4 mt-3 mb-4 flex h-9 items-center gap-2 rounded-[8px] px-3 shadow-[inset_0_0_0_1px_var(--rule-strong)] focus-within:shadow-[inset_0_0_0_1px_var(--ink-3)]">
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setPaused(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && note.trim()) answer('still')
          }}
          placeholder="补一句…（可选）"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
        />
        <Kbd>↵</Kbd>
      </div>
    </motion.div>
  )
}
