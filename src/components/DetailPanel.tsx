import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import * as repo from '@/lib/repo'
import {
  BUG_STATUS,
  PLAN_STATUS,
  SEVERITY,
  type Bug,
  type BugStatus,
  type EventRow,
  type Plan,
  type PlanStatus,
  type Severity,
} from '@/lib/types'
import { absTime, relTime, spanText } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { IconButton, StatusChip } from '@/components/ui/primitives'
import { ImageStrip } from '@/components/ImageStrip'
import { fade, slideIn, spring } from '@/components/ui/motion'

/* ------------------------------------------------------------------
   自动保存的文本域
   ------------------------------------------------------------------ */

function Field({
  label,
  value,
  placeholder,
  rows = 2,
  onCommit,
}: {
  label: string
  value: string
  placeholder?: string
  rows?: number
  onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [focus, setFocus] = useState(false)
  const dirty = draft !== value

  useEffect(() => setDraft(value), [value])

  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[10.5px] font-medium tracking-wide text-ink-500">{label}</span>
        <AnimatePresence>
          {dirty && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
            />
          )}
        </AnimatePresence>
      </div>
      <textarea
        rows={rows}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false)
          if (dirty) onCommit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value)
            e.currentTarget.blur()
          }
        }}
        className={clsx(
          'w-full resize-none rounded-[10px] border bg-tint-3 px-2.5 py-2 text-[12.5px] leading-relaxed',
          'transition-colors duration-150 placeholder:text-ink-600',
          focus ? 'border-tint-16 bg-tint-5' : 'border-tint-7',
        )}
      />
    </label>
  )
}

/* ------------------------------------------------------------------
   时间线
   ------------------------------------------------------------------ */

function Timeline({ entity, id, refreshKey }: { entity: 'plan' | 'bug'; id: number; refreshKey: number }) {
  const [events, setEvents] = useState<EventRow[]>([])

  useEffect(() => {
    let alive = true
    void repo.listEvents(entity, id).then((rows) => {
      if (alive) setEvents(rows)
    })
    return () => {
      alive = false
    }
  }, [entity, id, refreshKey])

  if (events.length === 0) return null

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium tracking-wide text-ink-500">
        <Icon name="history" size={11} />
        时间线
      </div>
      <div className="relative pl-3.5">
        <span className="absolute top-1 bottom-1 left-[3px] w-px bg-tint-8" />
        <AnimatePresence initial={false}>
          {events.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i * 0.02, 0.2) } }}
              className="relative pb-2.5"
            >
              <span
                className="absolute top-[5px] -left-[13px] h-[6px] w-[6px] rounded-full ring-2 ring-[var(--color-ink-900)]"
                style={{ background: dotColor(e) }}
              />
              <div className="text-[11.5px] text-ink-300">{describe(e)}</div>
              <div className="tnum text-[10.5px] text-ink-500">{absTime(e.created_at)}</div>
              {e.note && <div className="mt-0.5 text-[11px] text-ink-400">{e.note}</div>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function dotColor(e: EventRow): string {
  if (e.kind === 'create') return 'var(--color-draft)'
  if (e.kind === 'fix') return 'var(--color-done)'
  const to = e.to_value as PlanStatus | BugStatus | null
  if (to && to in PLAN_STATUS) return PLAN_STATUS[to as PlanStatus].color
  if (to && to in BUG_STATUS) return BUG_STATUS[to as BugStatus].color
  return 'var(--color-ink-400)'
}

function describe(e: EventRow): string {
  const label = (v: string | null) => {
    if (!v) return '—'
    if (v in PLAN_STATUS) return PLAN_STATUS[v as PlanStatus].label
    if (v in BUG_STATUS) return BUG_STATUS[v as BugStatus].label
    return v
  }
  switch (e.kind) {
    case 'create':
      return `创建为「${label(e.to_value)}」`
    case 'status':
      return `${label(e.from_value)} → ${label(e.to_value)}`
    case 'fix':
      return '标记为已修复'
    case 'checkin':
      return '巡检回答'
    default:
      return e.note ?? '更新'
  }
}

/* ------------------------------------------------------------------
   详情面板
   ------------------------------------------------------------------ */

export function DetailPanel({
  sel,
  refreshKey,
  onClose,
}: {
  sel: { entity: 'plan' | 'bug'; id: number }
  refreshKey: number
  onClose: () => void
}) {
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  const patchPlan = useStore((s) => s.patchPlan)
  const patchBug = useStore((s) => s.patchBug)
  const movePlan = useStore((s) => s.movePlan)
  const fixBug = useStore((s) => s.fixBug)
  const removePlan = useStore((s) => s.removePlan)
  const removeBug = useStore((s) => s.removeBug)

  const plan = sel.entity === 'plan' ? plans.find((p) => p.id === sel.id) : undefined
  const bug = sel.entity === 'bug' ? bugs.find((b) => b.id === sel.id) : undefined

  return (
    <motion.aside
      variants={slideIn}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex h-full w-[290px] shrink-0 flex-col border-l border-tint-7 bg-black/12"
    >
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
        <div className="drag flex flex-1 items-center self-stretch">
          <span className="text-[11px] font-medium tracking-wide text-ink-500">
            {sel.entity === 'plan' ? '计划详情' : 'BUG 详情'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton
            icon="trash"
            label="删除"
            size={13}
            tone="danger"
            onClick={() => (sel.entity === 'plan' ? void removePlan(sel.id) : void removeBug(sel.id))}
          />
          <IconButton icon="x" label="关闭" size={14} onClick={onClose} />
        </div>
      </div>

      <div className="scroll flex-1 px-3 pb-4">
        {plan && <PlanDetail plan={plan} onPatch={patchPlan} onStatus={movePlan} />}
        {bug && <BugDetail bug={bug} onPatch={patchBug} onFix={fixBug} />}
        {(plan || bug) && (
          <div className="mt-3">
            <ImageStrip entity={sel.entity} id={sel.id} />
          </div>
        )}
        {(plan || bug) && (
          <Timeline entity={sel.entity} id={sel.id} refreshKey={refreshKey} />
        )}
      </div>
    </motion.aside>
  )
}

function PlanDetail({
  plan,
  onPatch,
  onStatus,
}: {
  plan: Plan
  onPatch: (id: number, patch: Partial<Plan>) => Promise<void>
  onStatus: (id: number, s: PlanStatus) => Promise<void>
}) {
  const meta = PLAN_STATUS[plan.status]
  const took = spanText(plan.started_at, plan.finished_at)

  return (
    <motion.div variants={fade} initial="hidden" animate="show" className="space-y-3">
      <input
        defaultValue={plan.title}
        key={`t-${plan.id}`}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v && v !== plan.title) void onPatch(plan.id, { title: v })
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-full rounded-[10px] border border-transparent bg-transparent px-1.5 py-1 text-[14px] font-semibold text-ink-100 transition-colors hover:border-tint-8 focus:border-tint-16 focus:bg-tint-4"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip label={meta.label} color={meta.color} glyph={meta.glyph} />
        <span className="text-[11px] text-ink-500">{meta.hint}</span>
        {took && <span className="tnum text-[11px] text-ink-400">耗时 {took}</span>}
        <span className="tnum text-[11px] text-ink-500">更新 {relTime(plan.updated_at)}</span>
      </div>

      {/* 状态流转 */}
      <div>
        <div className="mb-1.5 text-[10.5px] font-medium tracking-wide text-ink-500">状态</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PLAN_STATUS) as PlanStatus[]).map((s) => {
            const st = PLAN_STATUS[s]
            const active = s === plan.status
            return (
              <motion.button
                key={s}
                type="button"
                whileTap={{ scale: 0.95 }}
                transition={spring}
                onClick={() => !active && void onStatus(plan.id, s)}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11.5px] transition-colors',
                  active ? 'font-medium' : 'border-tint-8 text-ink-300 hover:bg-tint-6',
                )}
                style={
                  active
                    ? {
                        color: st.color,
                        borderColor: `color-mix(in oklab, ${st.color} 40%, transparent)`,
                        background: `color-mix(in oklab, ${st.color} 16%, transparent)`,
                      }
                    : undefined
                }
              >
                <span className="text-[9px]">{st.glyph}</span>
                {st.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[10.5px] font-medium tracking-wide text-ink-500">优先级</div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void onPatch(plan.id, { priority: p })}
              className={clsx(
                'h-7 flex-1 rounded-[9px] border text-[11.5px] transition-colors',
                plan.priority === p
                  ? 'border-tint-20 bg-tint-12 text-ink-100'
                  : 'border-tint-7 text-ink-400 hover:bg-tint-5',
              )}
            >
              {['低', '中', '高', '紧急'][p]}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="预期结果"
        value={plan.expect}
        placeholder="做完了应该是什么样？"
        onCommit={(v) => void onPatch(plan.id, { expect: v })}
      />
      <Field
        label="实际结果"
        value={plan.result}
        placeholder="实际发生了什么？"
        onCommit={(v) => void onPatch(plan.id, { result: v })}
      />
      <Field
        label="复盘结论"
        value={plan.lesson}
        rows={3}
        placeholder={
          plan.status === 'failed'
            ? '死在哪一步？下次怎么绕开？'
            : '为什么成？能不能复用？'
        }
        onCommit={(v) => void onPatch(plan.id, { lesson: v })}
      />
      <Field
        label="备注"
        value={plan.detail}
        placeholder="补充说明、相关文件…"
        onCommit={(v) => void onPatch(plan.id, { detail: v })}
      />
    </motion.div>
  )
}

function BugDetail({
  bug,
  onPatch,
  onFix,
}: {
  bug: Bug
  onPatch: (id: number, patch: Partial<Bug>) => Promise<void>
  onFix: (id: number) => Promise<void>
}) {
  const meta = BUG_STATUS[bug.status]
  const isFixed = bug.status === 'fixed' || bug.status === 'verified'

  return (
    <motion.div variants={fade} initial="hidden" animate="show" className="space-y-3">
      <input
        defaultValue={bug.title}
        key={`bt-${bug.id}`}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v && v !== bug.title) void onPatch(bug.id, { title: v })
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-full rounded-[10px] border border-transparent bg-transparent px-1.5 py-1 text-[14px] font-semibold text-ink-100 transition-colors hover:border-tint-8 focus:border-tint-16 focus:bg-tint-4"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip label={meta.label} color={meta.color} glyph={meta.glyph} />
        {isFixed && bug.fixed_at && (
          <span className="text-[11px] text-[var(--color-done)]">修于 {relTime(bug.fixed_at)}</span>
        )}
        <span className="tnum text-[11px] text-ink-500">报于 {relTime(bug.created_at)}</span>
      </div>

      {!isFixed && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={spring}
          onClick={() => void onFix(bug.id)}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--color-done)]/16 text-[12.5px] font-medium text-[var(--color-done)] transition-colors hover:bg-[var(--color-done)]/24"
        >
          <Icon name="check" size={14} />
          标记已修复
        </motion.button>
      )}

      <div>
        <div className="mb-1.5 text-[10.5px] font-medium tracking-wide text-ink-500">严重度</div>
        <div className="flex gap-1.5">
          {(['low', 'normal', 'high', 'blocker'] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void onPatch(bug.id, { severity: s })}
              className={clsx(
                'h-7 flex-1 rounded-[9px] border text-[11.5px] transition-colors',
                bug.severity === s
                  ? 'border-tint-20 bg-tint-12 text-ink-100'
                  : 'border-tint-7 text-ink-400 hover:bg-tint-5',
              )}
            >
              {SEVERITY[s].label}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="复现步骤"
        value={bug.repro}
        rows={3}
        placeholder="怎么稳定复现？"
        onCommit={(v) => void onPatch(bug.id, { repro: v })}
      />
      <Field
        label="修复说明"
        value={bug.fix_note}
        rows={2}
        placeholder="怎么修的、改了什么"
        onCommit={(v) => void onPatch(bug.id, { fix_note: v })}
      />
      <Field
        label="关联提交"
        value={bug.fix_commit}
        rows={1}
        placeholder="commit hash"
        onCommit={(v) => void onPatch(bug.id, { fix_commit: v })}
      />
    </motion.div>
  )
}
