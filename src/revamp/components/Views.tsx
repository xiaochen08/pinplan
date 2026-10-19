import { Columns3, Download, FileJson, List } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { getState, select, setPlanStatus, setUI, useStore } from '@/revamp/lib/store'
import { useStats, useVisibleBugs, useVisiblePlans } from '@/revamp/lib/derive'
import { download, toJSON, toMarkdown } from '@/revamp/lib/export'
import type { Plan, PlanStatus } from '@/revamp/lib/types'
import { BOARD_COLUMNS, PLAN_ORDER, PLAN_STATUS, isOpenBug } from '@/revamp/lib/types'
import { dayKey, dayLabel, hhmm } from '@/revamp/lib/time'
import { useNow } from '@/revamp/lib/useNow'
import { BugRow, PlanRow, planTiming } from './Rows'
import { QuickAdd } from './QuickAdd'
import { describe, eventColor, eventNote } from './Timeline'
import { Btn, Glyph, Label, Segmented, Stamp, cx } from './ui'

function ViewHeader({ title, en, aside, children }: { title: string; en: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <header className="px-6 pt-6 pb-4 pl-[60px]">
      <div className="flex items-end gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.2em] text-ink-4">{en}</div>
          <h1 className="mt-1 font-cn text-[26px] leading-none font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="mb-0.5 min-w-0 flex-1 truncate text-[12px] text-ink-3">{aside}</div>
        {children}
      </div>
    </header>
  )
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-16 pl-[60px]">
      <p className="font-serif text-[26px] text-ink-3 italic">{title}</p>
      <p className="mt-1 text-[12.5px] text-ink-4">{hint}</p>
    </div>
  )
}

function Section({ label, color, count }: { label: string; color?: string; count: number }) {
  return (
    <li className="sticky top-0 z-[1] grid grid-cols-[48px_1fr] items-center bg-sheet/95 py-2 backdrop-blur-sm">
      <span />
      <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-ink-4">
        <span style={{ color }}>{label}</span>
        <span className="tnum">{count}</span>
        <span className="h-px flex-1 bg-rule" />
      </span>
    </li>
  )
}

/* ==================================================================
   Plans
   ================================================================== */

const FILTER_TEXT: Record<string, string> = {
  all: '全部',
  active: '待推进',
}

export function PlansView() {
  const plans = useVisiblePlans()
  const stats = useStats()
  const layout = useStore((s) => s.ui.layout)
  const filter = useStore((s) => s.ui.planFilter)
  const q = useStore((s) => s.ui.search)
  const now = useNow()

  const grouped = filter === 'all' || filter === 'active'
  const groups = useMemo(
    () => PLAN_ORDER.map((st) => ({ st, items: plans.filter((p) => p.status === st) })).filter((g) => g.items.length),
    [plans],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewHeader
        title="计划"
        en="PLANS"
        aside={
          <>
            <span className="text-ink-2">{FILTER_TEXT[filter] ?? PLAN_STATUS[filter as PlanStatus].label}</span> · {plans.length} 条
            {q && <> · 搜索「{q}」</>}
            {stats.unreviewed > 0 && (
              <button type="button" className="ml-2 cursor-pointer text-failed hover:underline" onClick={() => setUI({ planFilter: 'failed' })}>
                {stats.unreviewed} 条失败待复盘
              </button>
            )}
          </>
        }
      >
        <Segmented
          size="sm"
          value={layout}
          onChange={(v) => setUI({ layout: v })}
          options={[
            { value: 'list', label: <span className="flex items-center gap-1"><List size={12} />列表</span> },
            { value: 'board', label: <span className="flex items-center gap-1"><Columns3 size={12} />看板</span> },
          ]}
        />
      </ViewHeader>
      <div className="px-6 pb-3 pl-[60px]">
        <QuickAdd kind="plan" />
      </div>

      {layout === 'board' ? (
        <Board plans={plans} now={now} />
      ) : plans.length === 0 ? (
        <Empty title={q ? '没有匹配的记录' : '这一页还是空白'} hint={q ? '换个关键词试试。' : '在上面记下第一条计划，回车即可。'} />
      ) : (
        <ul className="scroll ruled relative min-h-0 flex-1 pb-16">
          {grouped ? (
            groups.map((g) => (
              <GroupBlock key={g.st} st={g.st} items={g.items} now={now} />
            ))
          ) : (
            <AnimatePresence initial={false}>{plans.map((p) => <PlanRow key={p.id} plan={p} now={now} />)}</AnimatePresence>
          )}
        </ul>
      )}
    </div>
  )
}

function GroupBlock({ st, items, now }: { st: PlanStatus; items: Plan[]; now: number }) {
  return (
    <>
      <Section label={`${PLAN_STATUS[st].label} · ${PLAN_STATUS[st].en}`} color={PLAN_STATUS[st].color} count={items.length} />
      <AnimatePresence initial={false}>
        {items.map((p) => (
          <PlanRow key={p.id} plan={p} now={now} />
        ))}
      </AnimatePresence>
    </>
  )
}

function Board({ plans, now }: { plans: Plan[]; now: number }) {
  const [over, setOver] = useState<PlanStatus | null>(null)
  const selected = useStore((s) => s.ui.selected)
  return (
    <div className="scroll flex min-h-0 flex-1 gap-3 px-6 pt-1 pb-6 pl-[60px]">
      {BOARD_COLUMNS.map((col) => {
        const items = plans.filter((p) => p.status === col)
        const meta = PLAN_STATUS[col]
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(col)
            }}
            onDragLeave={() => setOver((o) => (o === col ? null : o))}
            onDrop={(e) => {
              const id = Number(e.dataTransfer.getData('text/plan'))
              setOver(null)
              if (id) setPlanStatus(id, col)
            }}
            className={cx(
              'flex w-[230px] shrink-0 flex-col rounded-[10px] transition-colors',
              over === col ? 'bg-sheet-3 shadow-[inset_0_0_0_1.5px_var(--ink-3)]' : 'bg-sheet-2 shadow-[inset_0_0_0_1px_var(--rule)]',
            )}
          >
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <Glyph status={col} size={13} />
              <span className="text-[12.5px] font-semibold" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="font-mono text-[10.5px] text-ink-4">{items.length}</span>
            </div>
            <div className="scroll flex min-h-[80px] flex-1 flex-col gap-2 px-2 pb-2">
              {items.map((p) => {
                const closed = col === 'done' || col === 'failed' || col === 'dropped'
                const sel = selected?.kind === 'plan' && selected.id === p.id
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plan', String(p.id))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => select({ kind: 'plan', id: p.id })}
                    className={cx(
                      'relative cursor-grab rounded-[7px] bg-sheet p-2.5 transition-shadow active:cursor-grabbing',
                      sel ? 'shadow-[0_0_0_1.5px_var(--ink)]' : 'shadow-[0_0_0_1px_var(--rule),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_1px_var(--rule-strong),0_4px_10px_-4px_rgba(0,0,0,0.12)]',
                    )}
                  >
                    {col === 'doing' && <span className="breathe absolute top-2 bottom-2 left-0 w-[2.5px] rounded-full bg-doing" />}
                    <div className={cx('text-[13px] leading-snug', col === 'dropped' ? 'text-ink-4 line-through' : 'text-ink')}>{p.title}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-ink-4">{planTiming(p, now)}</span>
                      {closed && <Stamp label={meta.label} color={meta.color} tilt={-4} />}
                      {col === 'failed' && !p.lesson.trim() && <span className="text-[10px] font-medium text-failed">待复盘</span>}
                    </div>
                  </div>
                )
              })}
              {items.length === 0 && (
                <div className="grid flex-1 place-items-center rounded-[7px] border border-dashed border-rule-strong py-6 text-[11px] text-ink-4">拖到这里</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ==================================================================
   Bugs
   ================================================================== */

export function BugsView() {
  const bugs = useVisibleBugs()
  const q = useStore((s) => s.ui.search)
  const now = useNow()
  const open = bugs.filter((b) => isOpenBug(b.status))
  const closed = bugs.filter((b) => !isOpenBug(b.status))
  const hot = open.filter((b) => b.severity === 'blocker' || b.severity === 'high').length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewHeader
        title="BUG"
        en="DEFECTS"
        aside={
          <>
            {open.length} 个未了结
            {hot > 0 && <span className="text-bug"> · {hot} 个高危</span>} · {closed.length} 个已了结
          </>
        }
      />
      <div className="px-6 pb-3 pl-[60px]">
        <QuickAdd kind="bug" />
      </div>
      {bugs.length === 0 ? (
        <Empty title={q ? '没有匹配的 BUG' : '一个 BUG 也没有'} hint={q ? '换个关键词试试。' : '难得的好日子。'} />
      ) : (
        <ul className="scroll ruled relative min-h-0 flex-1 pb-16">
          {open.length > 0 && <Section label="未了结 · OPEN" color="var(--s-bug)" count={open.length} />}
          <AnimatePresence initial={false}>{open.map((b) => <BugRow key={b.id} bug={b} now={now} />)}</AnimatePresence>
          {closed.length > 0 && <Section label="已了结 · CLOSED" color="var(--s-done)" count={closed.length} />}
          <AnimatePresence initial={false}>{closed.map((b) => <BugRow key={b.id} bug={b} now={now} />)}</AnimatePresence>
        </ul>
      )}
    </div>
  )
}

/* ==================================================================
   Journal — the auto-generated dev log
   ================================================================== */

export function JournalView() {
  const events = useStore((s) => s.events)
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  const days = useMemo(() => {
    const map = new Map<string, typeof events>()
    for (const e of [...events].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const k = dayKey(e.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(e)
    }
    return [...map.entries()]
  }, [events])

  const title = (e: (typeof events)[number]) => {
    const t = e.entity === 'plan' ? plans.find((p) => p.id === e.entity_id)?.title : bugs.find((b) => b.id === e.entity_id)?.title
    return (
      <button
        type="button"
        className="cursor-pointer font-medium text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
        onClick={() => select({ kind: e.entity, id: e.entity_id })}
      >
        {t ?? '（已删除）'}
      </button>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewHeader title="日志" en="JOURNAL" aside={<>每次状态变更自动留痕 · {events.length} 条</>}>
        <Btn size="sm" icon={Download} onClick={() => download(`pinplan-${dayKey(new Date().toISOString())}.md`, toMarkdown(getState()), 'text/markdown')}>
          Markdown
        </Btn>
        <Btn size="sm" icon={FileJson} onClick={() => download(`pinplan-${dayKey(new Date().toISOString())}.json`, toJSON(getState()), 'application/json')}>
          JSON
        </Btn>
      </ViewHeader>
      {days.length === 0 ? (
        <Empty title="还没有日志" hint="记下计划或 BUG 之后，这里会自动生成开发日志。" />
      ) : (
        <div className="scroll min-h-0 flex-1 pb-16">
          {days.map(([k, list]) => {
            const label = dayLabel(k)
            const wins = list.filter((e) => e.kind === 'status' && e.to_value === 'done').length
            const losses = list.filter((e) => e.kind === 'status' && (e.to_value === 'failed' || e.to_value === 'dropped')).length
            const fixes = list.filter((e) => e.kind === 'fix').length
            return (
              <section key={k} className="grid grid-cols-[48px_1fr] gap-0 border-t border-rule first:border-t-0">
                <span />
                <div className="pr-6">
                  <div className="flex items-baseline gap-3 pt-5 pb-3">
                    <span className="font-cn text-[17px] font-semibold">{label.main}</span>
                    <span className="font-mono text-[10.5px] text-ink-4">{label.sub}</span>
                    <span className="ml-auto flex gap-2">
                      {wins > 0 && <Stamp label={`成 ${wins}`} color="var(--s-done)" tilt={-3} />}
                      {losses > 0 && <Stamp label={`败 ${losses}`} color="var(--s-failed)" tilt={2} />}
                      {fixes > 0 && <Stamp label={`修 ${fixes}`} color="var(--s-doing)" tilt={-2} />}
                    </span>
                  </div>
                  <ol className="pb-4">
                    {list.map((e) => {
                      const note = eventNote(e)
                      return (
                        <li key={e.id} className="grid grid-cols-[44px_14px_1fr] items-start gap-2 py-[5px] text-[13px] leading-relaxed">
                          <span className="pt-[2px] font-mono text-[10.5px] text-ink-4 tnum">{hhmm(e.created_at)}</span>
                          <span className="mt-[7px] h-[7px] w-[7px] rounded-full" style={{ background: eventColor(e) }} />
                          <div className="min-w-0 text-ink-2">
                            {describe(e, title(e))}
                            {note && <span className="ml-2 text-[12px] text-ink-3">“{note}”</span>}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { Label }
