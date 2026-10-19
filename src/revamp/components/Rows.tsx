import { Check, Pin, Play, X } from 'lucide-react'
import { motion } from 'motion/react'
import { select, setBugStatus, setPlanStatus, setUI, useStore } from '@/revamp/lib/store'
import type { Bug, Plan } from '@/revamp/lib/types'
import { BUG_STATUS, PLAN_STATUS, PRIORITY, SEVERITY, isOpenBug } from '@/revamp/lib/types'
import { ago, duration, shortDate } from '@/revamp/lib/time'
import { Btn, Glyph, Stamp, cx } from './ui'

export function planTiming(p: Plan, now: number): string {
  const since = (iso: string | null) => (iso ? now - new Date(iso).getTime() : 0)
  switch (p.status) {
    case 'doing':
      return `进行 ${duration(since(p.started_at))}`
    case 'done':
    case 'failed':
      return p.started_at && p.finished_at
        ? `用时 ${duration(new Date(p.finished_at).getTime() - new Date(p.started_at).getTime())}`
        : ago(p.finished_at ?? p.updated_at, now)
    case 'parked':
      return `搁置于 ${ago(p.updated_at, now)}`
    case 'dropped':
      return `放弃于 ${ago(p.finished_at ?? p.updated_at, now)}`
    default:
      return `${ago(p.created_at, now)}记下`
  }
}

const isFresh = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 2500

export function PlanRow({ plan, now, compact }: { plan: Plan; now: number; compact?: boolean }) {
  const selected = useStore((s) => s.ui.selected?.kind === 'plan' && s.ui.selected.id === plan.id)
  const projects = useStore((s) => s.projects)
  const project = projects.find((p) => p.id === plan.project_id)
  const meta = PLAN_STATUS[plan.status]
  const closed = plan.status === 'done' || plan.status === 'failed' || plan.status === 'dropped'
  const unreviewed = plan.status === 'failed' && !plan.lesson.trim()

  const actions =
    plan.status === 'doing' ? (
      <>
        <Btn size="sm" variant="tint" tone="var(--s-done)" icon={Check} onClick={(e) => (e.stopPropagation(), setPlanStatus(plan.id, 'done'))}>
          成功
        </Btn>
        <Btn size="sm" variant="tint" tone="var(--s-failed)" icon={X} onClick={(e) => (e.stopPropagation(), setPlanStatus(plan.id, 'failed'))}>
          失败
        </Btn>
      </>
    ) : plan.status === 'draft' || plan.status === 'parked' ? (
      <Btn size="sm" variant="tint" tone="var(--s-doing)" icon={Play} onClick={(e) => (e.stopPropagation(), setPlanStatus(plan.id, 'doing'))}>
        {plan.status === 'draft' ? '开始' : '继续'}
      </Btn>
    ) : null

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      onClick={() => (compact ? setUI({ selected: { kind: 'plan', id: plan.id }, mode: 'full' }) : select({ kind: 'plan', id: plan.id }))}
      className={cx(
        'group relative cursor-pointer border-b border-rule transition-colors',
        compact ? 'grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5' : 'grid grid-cols-[48px_1fr_auto] items-center gap-3 py-3 pr-4',
        selected ? 'bg-sheet-3' : 'hover:bg-sheet-2',
      )}
    >
      {plan.status === 'doing' && (
        <span
          className={cx('breathe absolute top-2 bottom-2 w-[2.5px] rounded-full bg-doing', compact ? 'left-0' : 'left-[46.5px]')}
          style={{ ['--rhythm' as string]: '2.6s' }}
        />
      )}
      {!compact && (
        <span className="justify-self-end pr-2 font-mono text-[10px] text-ink-4 tnum">{String(plan.id).padStart(3, '0')}</span>
      )}

      <div className="flex min-w-0 items-start gap-2.5">
        <Glyph status={plan.status} size={compact ? 13 : 15} className="mt-[2px] shrink-0" />
        <div className="min-w-0 flex-1">
          <div
            className={cx(
              'truncate leading-snug',
              compact ? 'text-[13px]' : 'text-[14.5px]',
              plan.status === 'dropped' ? 'text-ink-4 line-through decoration-ink-4' : 'text-ink',
              plan.status === 'done' && 'text-ink-2',
            )}
          >
            {plan.pinned && <Pin size={11} strokeWidth={2} className="mr-1 inline -translate-y-px text-seal" />}
            {plan.title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden font-mono text-[10.5px] whitespace-nowrap text-ink-4">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>·</span>
            <span className="tnum">{planTiming(plan, now)}</span>
            {plan.priority === 2 && (
              <>
                <span>·</span>
                <span className="text-ink-2">{PRIORITY[plan.priority]}优先</span>
              </>
            )}
            {!compact && project && (
              <>
                <span>·</span>
                <span className="truncate">{project.name}</span>
              </>
            )}
            {!compact && plan.tags.map((t) => <span key={t} className="text-ink-3">#{t}</span>)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {unreviewed && !compact && (
          <span className="rounded-[3px] bg-failed/10 px-1.5 py-0.5 text-[10.5px] font-medium text-failed">待复盘</span>
        )}
        {actions && (
          <div className={cx('gap-1', compact ? 'hidden group-hover:flex' : 'flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100')}>
            {actions}
          </div>
        )}
        {closed && (
          <Stamp
            label={meta.label}
            sub={compact ? undefined : shortDate(plan.finished_at ?? plan.updated_at)}
            color={meta.color}
            fresh={isFresh(plan.finished_at)}
            tilt={plan.id % 2 ? -5 : -3}
          />
        )}
      </div>
    </motion.li>
  )
}

export function SeverityTag({ bug }: { bug: Bug }) {
  const hot = bug.severity === 'blocker' || bug.severity === 'high'
  const open = isOpenBug(bug.status)
  return (
    <span
      className={cx('rounded-[3px] px-1 font-mono text-[10px] font-semibold', hot && open ? 'text-on-ink' : 'text-ink-3 shadow-[inset_0_0_0_1px_var(--rule-strong)]')}
      style={hot && open ? { background: bug.severity === 'blocker' ? 'var(--s-failed)' : 'var(--s-bug)' } : undefined}
    >
      {SEVERITY[bug.severity].short}
    </span>
  )
}

export function BugRow({ bug, now, compact }: { bug: Bug; now: number; compact?: boolean }) {
  const selected = useStore((s) => s.ui.selected?.kind === 'bug' && s.ui.selected.id === bug.id)
  const meta = BUG_STATUS[bug.status]
  const open = isOpenBug(bug.status)

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      onClick={() => (compact ? setUI({ selected: { kind: 'bug', id: bug.id }, mode: 'full', view: 'bugs' }) : select({ kind: 'bug', id: bug.id }))}
      className={cx(
        'group relative cursor-pointer border-b border-rule transition-colors',
        compact ? 'grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5' : 'grid grid-cols-[48px_1fr_auto] items-center gap-3 py-3 pr-4',
        selected ? 'bg-sheet-3' : 'hover:bg-sheet-2',
      )}
    >
      {!compact && <span className="justify-self-end pr-2 font-mono text-[10px] text-ink-4 tnum">B{String(bug.id).padStart(3, '0')}</span>}
      <div className="flex min-w-0 items-start gap-2.5">
        <Glyph status={bug.status} size={compact ? 13 : 15} className="mt-[2px] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className={cx('truncate leading-snug', compact ? 'text-[13px]' : 'text-[14.5px]', open ? 'text-ink' : 'text-ink-3')}>
            {bug.title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] whitespace-nowrap text-ink-4">
            <SeverityTag bug={bug} />
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>·</span>
            <span>{open ? `${ago(bug.created_at, now)}发现` : `${ago(bug.fixed_at ?? bug.updated_at, now)}修复`}</span>
            {!compact && bug.fix_commit && !open && (
              <>
                <span>·</span>
                <span className="text-ink-3">{bug.fix_commit}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center">
        {open ? (
          <Btn
            size="sm"
            variant="tint"
            tone="var(--s-done)"
            icon={Check}
            className={compact ? 'opacity-0 group-hover:opacity-100' : ''}
            onClick={(e) => (e.stopPropagation(), setBugStatus(bug.id, 'fixed'))}
          >
            {compact ? '修好' : '标记修复'}
          </Btn>
        ) : (
          <Stamp label={meta.label} color={meta.color} fresh={isFresh(bug.fixed_at)} tilt={-4} />
        )}
      </div>
    </motion.li>
  )
}
