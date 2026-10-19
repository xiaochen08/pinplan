import { motion } from 'motion/react'
import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import { PLAN_STATUS, type PlanStatus } from '@/lib/types'
import { Icon } from '@/components/ui/Icon'
import { spring } from '@/components/ui/motion'

const FILTERS: (PlanStatus | 'all')[] = ['all', 'doing', 'draft', 'done', 'failed', 'parked']

/** 展开态左侧栏：状态过滤 + 今日概览。 */
export function Sidebar() {
  const plans = useStore((s) => s.plans)
  const stats = useStore((s) => s.stats)
  const filter = useStore((s) => s.planFilter)
  const setFilter = useStore((s) => s.setPlanFilter)
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)

  const countOf = (s: PlanStatus | 'all') =>
    s === 'all' ? plans.length : plans.filter((p) => p.status === s).length

  const pick = (f: PlanStatus | 'all') => {
    setFilter(f)
    if (tab !== 'plan') setTab('plan')
  }

  return (
    <aside className="flex w-[148px] shrink-0 flex-col gap-3 border-r border-tint-7 px-2.5 py-3">
      <div>
        <div className="mb-1.5 px-1.5 text-[10.5px] font-medium tracking-wide text-ink-500">
          筛选
        </div>
        <div className="flex flex-col gap-0.5">
          {FILTERS.map((f) => {
            const active = tab === 'plan' && filter === f
            const meta = f === 'all' ? null : PLAN_STATUS[f]
            const n = countOf(f)
            return (
              <button
                key={f}
                type="button"
                onClick={() => pick(f)}
                className={clsx(
                  'relative flex items-center gap-2 rounded-[9px] px-2 py-1.5 text-left text-[12px] transition-colors duration-150',
                  active ? 'text-ink-100' : 'text-ink-400 hover:bg-tint-5 hover:text-ink-200',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    transition={spring}
                    className="absolute inset-0 -z-10 rounded-[9px] bg-tint-8"
                  />
                )}
                {meta ? (
                  <span
                    className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
                    style={{
                      color: meta.color,
                      background: `color-mix(in oklab, ${meta.color} 16%, transparent)`,
                    }}
                  >
                    {meta.glyph}
                  </span>
                ) : (
                  <Icon name="target" size={13} className="text-ink-400" />
                )}
                <span className="flex-1">{meta ? meta.label : '全部'}</span>
                <span className="tnum text-[10.5px] text-ink-500">{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <MiniStat label="待修 BUG" value={stats.bugsOpen} color="var(--color-bug)" />
        <MiniStat label="已修复" value={stats.bugsFixed} color="var(--color-done)" />
        <div className="px-1.5 pt-1 text-[10px] leading-relaxed text-ink-600">
          Alt+Space 显隐
          <br />
          Alt+N 记计划
          <br />
          Alt+B 记 BUG
        </div>
      </div>
    </aside>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[9px] border border-tint-6 bg-tint-3 px-2 py-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[11px] text-ink-400">{label}</span>
      <span className="tnum ml-auto text-[12px] font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
