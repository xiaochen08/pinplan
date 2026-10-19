import { mmss } from './time'
import type { Bug, Plan, PomodoroSnapshot, Severity } from './types'

/** 小钉的状态色。 */
export type DockTone = 'red' | 'blue' | 'green' | 'idle'
export type DockGlyph = 'bug' | 'target' | 'check' | 'pin'

export const TONE_COLOR: Record<DockTone, string> = {
  red: '#f87171',
  blue: '#60a5fa',
  green: '#34d399',
  idle: '#8b8d98',
}

/** 呼吸周期（秒），0 表示静止。红急、蓝稳、绿缓。 */
export const TONE_RHYTHM: Record<DockTone, number> = {
  red: 1.8,
  blue: 2.6,
  green: 3.6,
  idle: 0,
}

export interface DockStatus {
  tone: DockTone
  glyph: DockGlyph
  /** 角标数量 */
  count: number
  headline: string
  detail: string
}

/** 轮播用的一条提醒：小钉气泡逐条展示计划和 BUG。 */
export interface DockReminder {
  key: string
  /** 第一行：类别标签，比如「高危 BUG · 待修」 */
  label: string
  /** 第二行：条目标题 */
  title: string
  tone: DockTone
}

const SEV_RANK: Record<Severity, number> = { blocker: 0, high: 1, normal: 2, low: 3 }

const SEV_WORD: Record<Severity, string> = {
  blocker: '阻塞',
  high: '高危',
  normal: '中危',
  low: '低危',
}

/**
 * 把「还没了结的计划和 BUG」拍成一条条提醒，供小钉气泡定时轮播。
 *
 * 排序按处理优先级：阻塞/高危 BUG → 其他待修 BUG → 失败待复盘 → 进行中 → 草案 → 搁置。
 * 已完成、已修复、已放弃的不再提醒。
 */
export function dockReminders(plans: Plan[], bugs: Bug[]): DockReminder[] {
  const out: DockReminder[] = []

  const openBugs = bugs
    .filter((b) => b.status === 'open' || b.status === 'fixing')
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])

  for (const b of openBugs) {
    const hot = b.severity === 'blocker' || b.severity === 'high'
    out.push({
      key: `bug-${b.id}`,
      label: `${SEV_WORD[b.severity]} BUG · ${b.status === 'fixing' ? '修复中' : '待修'}`,
      title: b.title,
      tone: hot ? 'red' : 'blue',
    })
  }

  const add = (list: Plan[], label: string, tone: DockTone) => {
    for (const p of list) {
      out.push({ key: `plan-${p.id}`, label, title: p.title, tone })
    }
  }

  add(
    plans.filter((p) => p.status === 'failed' && p.lesson.trim().length === 0),
    '失败待复盘',
    'red',
  )
  add(
    plans.filter((p) => p.status === 'doing'),
    '计划 · 进行中',
    'blue',
  )
  add(
    plans.filter((p) => p.status === 'draft'),
    '计划 · 草案',
    'idle',
  )
  add(
    plans.filter((p) => p.status === 'parked'),
    '计划 · 搁置',
    'idle',
  )

  return out
}

/**
 * 状态判定（优先级：红 > 蓝 > 绿 > 灰）
 *
 * 红 = 有阻塞/高危 BUG 待修，或有失败还没复盘
 * 蓝 = 有进行中条目，或番茄钟在跑
 * 绿 = 没有待办且今天有成果
 * 灰 = 还没有任何记录
 */
export function deriveDockStatus(
  plans: Plan[],
  bugs: Bug[],
  pomo: PomodoroSnapshot,
): DockStatus {
  // 角标 = 所有待办条目总数（和气泡轮播的 1/N 保持一致），
  // 而不是只数当前状态所指的那一类 —— 否则会出现「气泡说 1/5、角标却是 1」的矛盾。
  const pending = dockReminders(plans, bugs).length

  const urgent = bugs.filter(
    (b) =>
      (b.status === 'open' || b.status === 'fixing') &&
      (b.severity === 'blocker' || b.severity === 'high'),
  )
  if (urgent.length > 0) {
    return {
      tone: 'red',
      glyph: 'bug',
      count: pending,
      headline: `${urgent.length} 个高危 BUG 待修`,
      detail: urgent[0].title,
    }
  }

  const unreviewed = plans.filter((p) => p.status === 'failed' && p.lesson.trim().length === 0)
  if (unreviewed.length > 0) {
    return {
      tone: 'red',
      glyph: 'target',
      count: pending,
      headline: `${unreviewed.length} 条失败待复盘`,
      detail: unreviewed[0].title,
    }
  }

  const doing = plans.filter((p) => p.status === 'doing')

  if (pomo.running) {
    return {
      tone: 'blue',
      glyph: 'target',
      count: pending,
      headline:
        pomo.phase === 'work' ? `专注中 ${mmss(pomo.remaining)}` : `休息中 ${mmss(pomo.remaining)}`,
      detail: doing.length > 0 ? `${doing.length} 条进行中` : '没有进行中的计划',
    }
  }

  if (doing.length > 0) {
    return {
      tone: 'blue',
      glyph: 'target',
      count: pending,
      headline: `${doing.length} 条进行中`,
      detail: doing[0].title,
    }
  }

  const done = plans.filter((p) => p.status === 'done')
  const fixed = bugs.filter((b) => b.status === 'fixed' || b.status === 'verified')
  if (done.length > 0 || fixed.length > 0) {
    return {
      tone: 'green',
      glyph: 'check',
      count: 0,
      headline: '全部完成',
      detail: `成功 ${done.length} · 修复 ${fixed.length}`,
    }
  }

  return {
    tone: 'idle',
    glyph: 'pin',
    count: 0,
    headline: '还没有记录',
    detail: '点一下打开 PinPlan',
  }
}
