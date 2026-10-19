import { mmss } from './time'
import type { Bug, Plan } from './types'
import { SEVERITY } from './types'
import type { Pomodoro } from './store'

export type DockTone = 'red' | 'blue' | 'green' | 'idle'

export const TONE_COLOR: Record<DockTone, string> = {
  red: 'var(--s-failed)',
  blue: 'var(--s-doing)',
  green: 'var(--s-done)',
  idle: 'var(--ink-4)',
}

/** Breathing period in seconds — red urgent, blue steady, green slow, idle still. */
export const TONE_RHYTHM: Record<DockTone, number> = { red: 1.8, blue: 2.6, green: 3.6, idle: 0 }

export interface Reminder {
  key: string
  label: string
  title: string
  tone: DockTone
}

export interface DockStatus {
  tone: DockTone
  count: number
  headline: string
  detail: string
}

export function reminders(plans: Plan[], bugs: Bug[]): Reminder[] {
  const out: Reminder[] = []
  const open = bugs
    .filter((b) => b.status === 'open' || b.status === 'fixing')
    .sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank)
  for (const b of open) {
    const hot = b.severity === 'blocker' || b.severity === 'high'
    out.push({
      key: `bug-${b.id}`,
      label: `${SEVERITY[b.severity].label} BUG · ${b.status === 'fixing' ? '修复中' : '待修'}`,
      title: b.title,
      tone: hot ? 'red' : 'blue',
    })
  }
  const add = (list: Plan[], label: string, tone: DockTone) =>
    list.forEach((p) => out.push({ key: `plan-${p.id}`, label, title: p.title, tone }))
  add(plans.filter((p) => p.status === 'failed' && !p.lesson.trim()), '失败 · 待复盘', 'red')
  add(plans.filter((p) => p.status === 'doing'), '计划 · 进行中', 'blue')
  add(plans.filter((p) => p.status === 'draft'), '计划 · 草案', 'idle')
  add(plans.filter((p) => p.status === 'parked'), '计划 · 搁置', 'idle')
  return out
}

/** Priority: red > blue > green > idle. */
export function dockStatus(plans: Plan[], bugs: Bug[], pomo: Pomodoro): DockStatus {
  const count = reminders(plans, bugs).length
  const urgent = bugs.filter(
    (b) => (b.status === 'open' || b.status === 'fixing') && (b.severity === 'blocker' || b.severity === 'high'),
  )
  if (urgent.length)
    return { tone: 'red', count, headline: `${urgent.length} 个高危 BUG 待修`, detail: urgent[0].title }
  const unreviewed = plans.filter((p) => p.status === 'failed' && !p.lesson.trim())
  if (unreviewed.length)
    return { tone: 'red', count, headline: `${unreviewed.length} 条失败待复盘`, detail: unreviewed[0].title }
  const doing = plans.filter((p) => p.status === 'doing')
  if (pomo.running)
    return {
      tone: 'blue',
      count,
      headline: `${pomo.phase === 'work' ? '专注中' : '休息中'} ${mmss(pomo.remaining)}`,
      detail: doing.length ? `${doing.length} 条进行中` : '没有进行中的计划',
    }
  if (doing.length) return { tone: 'blue', count, headline: `${doing.length} 条进行中`, detail: doing[0].title }
  const done = plans.filter((p) => p.status === 'done').length
  const fixed = bugs.filter((b) => b.status === 'fixed' || b.status === 'verified').length
  if (done || fixed) return { tone: 'green', count: 0, headline: '全部了结', detail: `成功 ${done} · 修复 ${fixed}` }
  return { tone: 'idle', count: 0, headline: '还没有记录', detail: '点一下打开 PinPlan' }
}
