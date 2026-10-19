import { ArrowRight, Pin, PinOff, Trash2, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import {
  deleteBug,
  deletePlan,
  select,
  setBugStatus,
  setPlanStatus,
  togglePin,
  updateBug,
  updatePlan,
  useStore,
} from '@/revamp/lib/store'
import type { Bug, Plan, Severity } from '@/revamp/lib/types'
import { BUG_FLOW, BUG_STATUS, PLAN_FLOW, PLAN_STATUS, PRIORITY, SEVERITY, isClosedPlan } from '@/revamp/lib/types'
import { ago, duration, shortDate } from '@/revamp/lib/time'
import { useNow } from '@/revamp/lib/useNow'
import { Glyph, IconBtn, Label, Segmented, Stamp, cx, no } from './ui'
import { Timeline } from './Timeline'
import { SeverityTag } from './Rows'
import { ImageStrip } from '@/components/ImageStrip'
import { toast } from '@/revamp/lib/store'

const imageNotice = (message: string) => toast(message)

/* ------------------------------------------------------------------ */

function Field({
  index,
  label,
  en,
  value,
  placeholder,
  onChange,
  alert,
}: {
  index: string
  label: string
  en: string
  value: string
  placeholder: string
  onChange: (v: string) => void
  alert?: boolean
}) {
  return (
    <div className={cx('relative grid grid-cols-[34px_1fr] border-t border-rule py-3', alert && 'bg-failed/[0.04]')}>
      {alert && <span className="absolute top-0 bottom-0 left-0 w-[2px] bg-failed" />}
      <span className="pt-[2px] pl-0.5 font-serif text-[18px] leading-none text-ink-4 italic">{index}</span>
      <div>
        <div className="mb-1 flex items-baseline gap-2">
          <span className={cx('text-[12.5px] font-semibold', alert ? 'text-failed' : 'text-ink')}>{label}</span>
          <span className="font-mono text-[9.5px] tracking-[0.14em] text-ink-4">{en}</span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={1}
          className="autosize block min-h-[22px] w-full resize-none bg-transparent text-[13px] leading-[1.7] text-ink-2 outline-none"
        />
      </div>
    </div>
  )
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3 text-[12px]">
      <span className="text-ink-3">{k}</span>
      <span className="text-right text-ink-2">{children}</span>
    </div>
  )
}

function DangerButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false)
  return armed ? (
    <button
      type="button"
      onClick={onConfirm}
      onMouseLeave={() => setArmed(false)}
      className="h-7 cursor-pointer rounded-[6px] bg-failed px-2 text-[11.5px] font-medium text-white"
    >
      确认删除
    </button>
  ) : (
    <IconBtn icon={Trash2} label={label} size={14} onClick={() => setArmed(true)} />
  )
}

function Header({ id, children, onClose }: { id: string; children?: ReactNode; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex h-11 items-center gap-1 border-b border-rule bg-sheet/95 px-4 backdrop-blur">
      <span className="font-mono text-[10.5px] text-ink-4">{id}</span>
      <div className="ml-auto flex items-center gap-0.5">
        {children}
        <IconBtn icon={X} label="关闭 (Esc)" onClick={onClose} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function PlanDetail({ plan }: { plan: Plan }) {
  const now = useNow(15_000)
  const allEvents = useStore((s) => s.events)
  const projects = useStore((s) => s.projects)
  const bugs = useStore((s) => s.bugs)
  const events = useMemo(() => allEvents.filter((e) => e.entity === 'plan' && e.entity_id === plan.id), [allEvents, plan.id])
  const linked = useMemo(() => bugs.filter((b) => b.plan_id === plan.id), [bugs, plan.id])
  const meta = PLAN_STATUS[plan.status]
  const closed = isClosedPlan(plan.status)
  const unreviewed = plan.status === 'failed' && !plan.lesson.trim()

  const lessonHint =
    plan.status === 'failed'
      ? '死在哪一步？下次怎么绕开？'
      : plan.status === 'done'
        ? '为什么成？哪些做法能复用？'
        : plan.status === 'dropped'
          ? '为什么放弃？当初哪里判断错了？'
          : '了结之后再写，也可以先记下直觉。'

  const elapsed = plan.started_at
    ? duration((plan.finished_at ? new Date(plan.finished_at).getTime() : now) - new Date(plan.started_at).getTime())
    : '—'

  return (
    <div className="flex h-full flex-col">
      <Header id={no(plan.id)} onClose={() => select(null)}>
        <IconBtn icon={plan.pinned ? PinOff : Pin} label={plan.pinned ? '取消置顶' : '置顶'} size={14} active={plan.pinned} onClick={() => togglePin(plan.id)} />
        <DangerButton label="删除计划" onConfirm={() => deletePlan(plan.id)} />
      </Header>

      <div className="scroll flex-1 px-5 pb-10">
        <div className="relative pt-5">
          <textarea
            value={plan.title}
            onChange={(e) => updatePlan(plan.id, { title: e.target.value.replace(/\n/g, '') })}
            rows={1}
            className={cx(
              'autosize block w-full resize-none bg-transparent pr-16 font-cn text-[21px] leading-[1.4] font-semibold outline-none',
              plan.status === 'dropped' && 'text-ink-3 line-through decoration-ink-4 decoration-1',
            )}
          />
          {closed && (
            <span className="absolute top-6 right-0">
              <Stamp label={meta.label} sub={shortDate(plan.finished_at ?? plan.updated_at)} color={meta.color} size="lg" tilt={-8} />
            </span>
          )}
        </div>

        {/* Status + transitions */}
        <div className="mt-4 rounded-[9px] bg-sheet-2 p-3 shadow-[0_0_0_1px_var(--rule)]">
          <div className="flex items-center gap-2">
            <Glyph status={plan.status} size={16} />
            <span className="text-[13px] font-semibold" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-[12px] text-ink-3">{meta.hint}</span>
            <span className="ml-auto font-mono text-[10.5px] text-ink-4">{plan.status === 'doing' ? `已进行 ${elapsed}` : ''}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <ArrowRight size={12} className="text-ink-4" />
            {PLAN_FLOW[plan.status].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setPlanStatus(plan.id, st)}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] bg-sheet px-2.5 text-[12px] font-medium shadow-[0_0_0_1px_var(--rule-strong)] transition-[transform,box-shadow] hover:shadow-[0_0_0_1px_currentColor] active:scale-[0.97]"
                style={{ color: PLAN_STATUS[st].color }}
              >
                <Glyph status={st} size={12} />
                {st === 'doing' && plan.status !== 'draft' ? '复活' : PLAN_STATUS[st].label}
              </button>
            ))}
          </div>
        </div>

        {/* Facts */}
        <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Fact k="优先级">
            <Segmented size="sm" value={plan.priority} onChange={(v) => updatePlan(plan.id, { priority: v })} options={PRIORITY.map((l, i) => ({ value: i, label: l }))} />
          </Fact>
          <Fact k="项目">
            <select
              value={plan.project_id ?? ''}
              onChange={(e) => updatePlan(plan.id, { project_id: e.target.value ? Number(e.target.value) : null })}
              className="cursor-pointer bg-transparent text-right text-[12px] text-ink-2 outline-none"
            >
              <option value="">未归类</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Fact>
          <Fact k="记下">
            <span className="font-mono text-[11px]">{ago(plan.created_at, now)}</span>
          </Fact>
          <Fact k={closed ? '用时' : '已进行'}>
            <span className="font-mono text-[11px]">{elapsed}</span>
          </Fact>
          <div className="sm:col-span-2">
            <Fact k="标签">
              <input
                value={plan.tags.join(' ')}
                onChange={(e) => updatePlan(plan.id, { tags: e.target.value.split(/[\s,，]+/).filter(Boolean) })}
                placeholder="空格分隔"
                className="w-48 bg-transparent text-right font-mono text-[11px] text-ink-2 outline-none"
              />
            </Fact>
          </div>
        </div>

        {/* The three-part ledger */}
        <div className="mt-4 border-b border-rule">
          <Field index="01" label="预期" en="EXPECT" value={plan.expect} onChange={(v) => updatePlan(plan.id, { expect: v })} placeholder="做成了应该是什么样？写可验证的结果。" />
          <Field index="02" label="实际" en="RESULT" value={plan.result} onChange={(v) => updatePlan(plan.id, { result: v })} placeholder="实际发生了什么？数据、现象、卡点。" />
          <Field
            index="03"
            label={unreviewed ? '复盘 · 待补' : '复盘'}
            en="LESSON"
            value={plan.lesson}
            onChange={(v) => updatePlan(plan.id, { lesson: v })}
            placeholder={lessonHint}
            alert={unreviewed}
          />
          <Field index="—" label="备注" en="NOTES" value={plan.detail} onChange={(v) => updatePlan(plan.id, { detail: v })} placeholder="链接、命令、上下文…" />
        </div>

        {linked.length > 0 && (
          <section className="mt-6">
            <Label className="mb-2">关联 BUG · {linked.length}</Label>
            <ul className="space-y-1">
              {linked.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => select({ kind: 'bug', id: b.id })} className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] hover:bg-sheet-2">
                    <Glyph status={b.status} size={13} />
                    <SeverityTag bug={b} />
                    <span className="truncate text-ink-2">{b.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 border-t border-rule pt-4"><ImageStrip entity="plan" id={plan.id} onNotify={imageNotice} /></section>
        <section className="mt-6">
          <Label className="mb-2">时间线 · {events.length}</Label>
          <Timeline events={events} now={now} />
        </section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const SEV_OPTS: Severity[] = ['blocker', 'high', 'normal', 'low']

export function BugDetail({ bug }: { bug: Bug }) {
  const now = useNow(15_000)
  const allEvents = useStore((s) => s.events)
  const plans = useStore((s) => s.plans)
  const events = useMemo(() => allEvents.filter((e) => e.entity === 'bug' && e.entity_id === bug.id), [allEvents, bug.id])
  const meta = BUG_STATUS[bug.status]
  const resolved = bug.status === 'fixed' || bug.status === 'verified' || bug.status === 'wontfix'
  const plan = plans.find((p) => p.id === bug.plan_id)

  return (
    <div className="flex h-full flex-col">
      <Header id={`BUG · B${String(bug.id).padStart(3, '0')}`} onClose={() => select(null)}>
        <DangerButton label="删除 BUG" onConfirm={() => deleteBug(bug.id)} />
      </Header>
      <div className="scroll flex-1 px-5 pb-10">
        <div className="relative pt-5">
          <textarea
            value={bug.title}
            onChange={(e) => updateBug(bug.id, { title: e.target.value.replace(/\n/g, '') })}
            rows={1}
            className="autosize block w-full resize-none bg-transparent pr-20 font-cn text-[21px] leading-[1.4] font-semibold outline-none"
          />
          {resolved && (
            <span className="absolute top-6 right-0">
              <Stamp label={meta.label} sub={bug.fixed_at ? shortDate(bug.fixed_at) : undefined} color={meta.color} size="lg" tilt={-8} />
            </span>
          )}
        </div>

        <div className="mt-4 rounded-[9px] bg-sheet-2 p-3 shadow-[0_0_0_1px_var(--rule)]">
          <div className="flex items-center gap-2">
            <Glyph status={bug.status} size={16} />
            <span className="text-[13px] font-semibold" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-[12px] text-ink-3">{meta.hint}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <ArrowRight size={12} className="text-ink-4" />
            {BUG_FLOW[bug.status].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setBugStatus(bug.id, st)}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] bg-sheet px-2.5 text-[12px] font-medium shadow-[0_0_0_1px_var(--rule-strong)] transition-[transform,box-shadow] hover:shadow-[0_0_0_1px_currentColor] active:scale-[0.97]"
                style={{ color: BUG_STATUS[st].color }}
              >
                <Glyph status={st} size={12} />
                {st === 'open' ? '重新打开' : BUG_STATUS[st].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-0.5">
          <Fact k="严重度">
            <Segmented
              size="sm"
              value={bug.severity}
              onChange={(v) => updateBug(bug.id, { severity: v })}
              options={SEV_OPTS.map((s) => ({ value: s, label: SEVERITY[s].label, color: s === 'blocker' || s === 'high' ? 'var(--s-bug)' : undefined }))}
            />
          </Fact>
          <Fact k="关联计划">
            <select
              value={bug.plan_id ?? ''}
              onChange={(e) => updateBug(bug.id, { plan_id: e.target.value ? Number(e.target.value) : null })}
              className="max-w-[220px] cursor-pointer truncate bg-transparent text-right text-[12px] text-ink-2 outline-none"
            >
              <option value="">无</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Fact>
          <Fact k="发现">
            <span className="font-mono text-[11px]">{ago(bug.created_at, now)}</span>
          </Fact>
          {bug.fixed_at && (
            <Fact k="修复">
              <span className="font-mono text-[11px]">{ago(bug.fixed_at, now)}</span>
            </Fact>
          )}
          <Fact k="Commit">
            <input
              value={bug.fix_commit}
              onChange={(e) => updateBug(bug.id, { fix_commit: e.target.value.trim() })}
              placeholder="a3f9c1e"
              className="w-28 bg-transparent text-right font-mono text-[11px] text-ink-2 outline-none"
            />
          </Fact>
        </div>

        <div className="mt-4 border-b border-rule">
          <Field index="01" label="复现" en="REPRO" value={bug.repro} onChange={(v) => updateBug(bug.id, { repro: v })} placeholder="1. 打开… 2. 点击… 3. 看到…" />
          <Field index="02" label="修复说明" en="FIX" value={bug.fix_note} onChange={(v) => updateBug(bug.id, { fix_note: v })} placeholder="根因是什么？怎么修的？" />
        </div>

        <section className="mt-6 border-t border-rule pt-4"><ImageStrip entity="bug" id={bug.id} onNotify={imageNotice} /></section>
        {plan && (
          <section className="mt-6">
            <Label className="mb-2">关联计划</Label>
            <button type="button" onClick={() => select({ kind: 'plan', id: plan.id })} className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] hover:bg-sheet-2">
              <Glyph status={plan.status} size={13} />
              <span className="truncate text-ink-2">{plan.title}</span>
            </button>
          </section>
        )}

        <section className="mt-6">
          <Label className="mb-2">时间线 · {events.length}</Label>
          <Timeline events={events} now={now} />
        </section>
      </div>
    </div>
  )
}

export function DetailPane() {
  const sel = useStore((s) => s.ui.selected)
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  if (!sel) return null
  if (sel.kind === 'plan') {
    const p = plans.find((x) => x.id === sel.id)
    return p ? <PlanDetail key={p.id} plan={p} /> : null
  }
  const b = bugs.find((x) => x.id === sel.id)
  return b ? <BugDetail key={b.id} bug={b} /> : null
}
