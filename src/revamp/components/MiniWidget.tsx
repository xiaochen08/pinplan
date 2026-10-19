import { EyeOff, Maximize2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useMemo, useState } from 'react'
import { setUI, useStore } from '@/revamp/lib/store'
import { sortBugs, sortPlans, useStats } from '@/revamp/lib/derive'
import { todayParts } from '@/revamp/lib/time'
import { useNow } from '@/revamp/lib/useNow'
import { Pomodoro } from './Pomodoro'
import { QuickAdd } from './QuickAdd'
import { BugRow, PlanRow } from './Rows'
import { BrandMark } from './Shell'
import { IconBtn, Ring, cx } from './ui'

/** 钉子小窗 — the always-on-top 340px companion. */
export function MiniWidget() {
  const [tab, setTab] = useState<'plan' | 'bug'>('plan')
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  const stats = useStats()
  const now = useNow()
  const t = todayParts()
  const sortedPlans = useMemo(() => sortPlans(plans), [plans])
  const sortedBugs = useMemo(() => sortBugs(bugs), [bugs])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-rule px-4 pt-3.5 pb-3">
        <div data-tauri-drag-region className="drag min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BrandMark size={8} />
            <span className="font-cn text-[14px] font-semibold">
              {t.monthNum}月{t.day}日 {t.weekday}
            </span>
          </div>
          <div className="mt-1 font-mono text-[10.5px] text-ink-4">
            <span className="text-doing">{stats.doing} 进行</span> · <span className="text-done">{stats.done} 成功</span> ·{' '}
            <span className={stats.openBugs ? 'text-bug' : ''}>{stats.openBugs} BUG</span>
          </div>
        </div>
        <Ring value={stats.rate} size={36} stroke={2.5}>
          <span className="font-serif text-[12.5px] leading-none tnum">{Math.round(stats.rate * 100)}</span>
        </Ring>
        <div className="-mr-1.5 flex">
          <IconBtn icon={Maximize2} label="展开主窗" size={14} onClick={() => setUI({ mode: 'full' })} />
          <IconBtn icon={EyeOff} label="藏到边缘" size={14} onClick={() => setUI({ hidden: true })} />
        </div>
      </div>

      <Pomodoro compact />

      <div className="flex items-center gap-4 border-b border-rule px-4">
        {(['plan', 'bug'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cx(
              'relative -mb-px flex h-9 cursor-pointer items-center gap-1.5 border-b-[1.5px] text-[12.5px] font-medium transition-colors',
              tab === k ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink-2',
            )}
          >
            {k === 'plan' ? '计划' : 'BUG'}
            <span className={cx('font-mono text-[10.5px]', k === 'bug' && stats.openBugs ? 'text-bug' : 'text-ink-4')}>
              {k === 'plan' ? stats.doing + stats.draft : stats.openBugs}
            </span>
          </button>
        ))}
      </div>

      <ul className="scroll min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {tab === 'plan'
            ? sortedPlans.map((p) => <PlanRow key={p.id} plan={p} now={now} compact />)
            : sortedBugs.map((b) => <BugRow key={b.id} bug={b} now={now} compact />)}
        </AnimatePresence>
      </ul>

      <QuickAdd kind={tab} compact />
    </div>
  )
}
