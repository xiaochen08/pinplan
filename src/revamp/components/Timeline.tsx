import type { EventRow } from '@/revamp/lib/types'
import { BUG_STATUS, PLAN_STATUS } from '@/revamp/lib/types'
import { hhmm, ago } from '@/revamp/lib/time'
import { cx } from './ui'
import type { ReactNode } from 'react'

export const CHECKIN_LABEL: Record<string, string> = {
  still: '还在做',
  stuck: '卡住了',
  park: '先搁置',
  done: '已完成',
  drop: '放弃',
}

function statusWord(entity: EventRow['entity'], v: string | null) {
  if (!v) return null
  const meta = entity === 'plan' ? PLAN_STATUS[v as keyof typeof PLAN_STATUS] : BUG_STATUS[v as keyof typeof BUG_STATUS]
  if (!meta) return <span>{v}</span>
  return (
    <span className="font-medium" style={{ color: meta.color }}>
      {meta.label}
    </span>
  )
}

export function eventColor(e: EventRow): string {
  if (e.kind === 'checkin') return 'var(--ink-3)'
  if (e.kind === 'fix') return 'var(--s-done)'
  if (e.kind === 'create') return 'var(--ink-4)'
  const v = e.to_value ?? ''
  return (
    (e.entity === 'plan' ? PLAN_STATUS[v as keyof typeof PLAN_STATUS]?.color : BUG_STATUS[v as keyof typeof BUG_STATUS]?.color) ??
    'var(--ink-3)'
  )
}

/** One-line human description of an event. `subject` is the entity title, if shown. */
export function describe(e: EventRow, subject?: ReactNode): ReactNode {
  const s = subject ? <>{subject} </> : null
  switch (e.kind) {
    case 'comment':
      return <>{s}补充备注</>
    case 'create':
      return (
        <>
          记下{e.entity === 'bug' ? ' BUG' : ''} {s}
        </>
      )
    case 'status':
      return (
        <>
          {s}
          {statusWord(e.entity, e.from_value)} <span className="text-ink-4">→</span> {statusWord(e.entity, e.to_value)}
        </>
      )
    case 'fix':
      return (
        <>
          修复 {s}
          {e.note && <span className="ml-1 rounded-[3px] bg-sheet-3 px-1 font-mono text-[10.5px] text-ink-2">{e.note}</span>}
        </>
      )
    case 'checkin': {
      const [key] = (e.note ?? '').split('｜')
      return (
        <>
          巡检 {s}
          <span className="text-ink-4">·</span> <span className="font-medium text-ink-2">{CHECKIN_LABEL[key] ?? key}</span>
        </>
      )
    }
  }
}

export function eventNote(e: EventRow): string | null {
  if (e.kind === 'fix') return null
  if (e.kind === 'checkin') return (e.note ?? '').split('｜')[1] ?? null
  return e.note
}

export function Timeline({ events, now }: { events: EventRow[]; now: number }) {
  if (!events.length) return <p className="text-[12px] text-ink-4">还没有记录。</p>
  return (
    <ol className="relative">
      <span className="absolute top-2 bottom-2 left-[4.5px] w-px bg-rule" />
      {[...events].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).map((e, i) => {
        const note = eventNote(e)
        return (
          <li key={e.id} className="relative grid grid-cols-[10px_1fr_auto] gap-3 py-1.5">
            <span
              className={cx('relative mt-[5px] h-[10px] w-[10px] rounded-full border-2 border-sheet', i === 0 && 'ring-2 ring-sheet')}
              style={{ background: eventColor(e) }}
            />
            <div className="min-w-0 text-[12.5px] leading-relaxed text-ink-2">
              {describe(e)}
              {note && <div className="mt-0.5 text-[12px] text-ink-3">“{note}”</div>}
            </div>
            <span className="pt-[3px] font-mono text-[10.5px] text-ink-4 tnum" title={new Date(e.created_at).toLocaleString('zh-CN')}>
              {now - new Date(e.created_at).getTime() < 86_400_000 ? hhmm(e.created_at) : ago(e.created_at, now)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
