/** 领域模型与状态机定义。 */

export type PlanStatus = 'draft' | 'doing' | 'done' | 'failed' | 'parked' | 'dropped'
export type BugStatus = 'open' | 'fixing' | 'fixed' | 'verified' | 'wontfix'
export type Severity = 'low' | 'normal' | 'high' | 'blocker'
export type Entity = 'plan' | 'bug'

export interface Plan {
  id: number
  project_id: number | null
  title: string
  detail: string
  status: PlanStatus
  priority: number
  expect: string
  result: string
  lesson: string
  tags: string
  refs: string
  pinned: number
  sort: number
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

export interface Bug {
  id: number
  project_id: number | null
  plan_id: number | null
  title: string
  repro: string
  severity: Severity
  status: BugStatus
  fix_note: string
  fix_commit: string
  fixed_at: string | null
  tags: string
  refs: string
  created_at: string
  updated_at: string
}

export interface EventRow {
  id: number
  entity: Entity
  entity_id: number
  kind: 'create' | 'status' | 'comment' | 'checkin' | 'fix'
  from_value: string | null
  to_value: string | null
  note: string | null
  created_at: string
}

export interface Project {
  id: number
  name: string
  color: string
  sort: number
  archived: number
  created_at: string
}

/** 番茄钟快照，主窗每秒广播给边缘小钉。 */
export interface PomodoroSnapshot {
  running: boolean
  phase: 'work' | 'break'
  remaining: number
  total: number
  completed: number
}

/* ------------------------------------------------------------------
   状态机
   ------------------------------------------------------------------ */

export const PLAN_STATUS: Record<
  PlanStatus,
  { label: string; color: string; glyph: string; hint: string }
> = {
  draft: { label: '草案', color: 'var(--color-draft)', glyph: '·', hint: '还没开始' },
  doing: { label: '进行中', color: 'var(--color-doing)', glyph: '◐', hint: '正在推进' },
  done: { label: '成功', color: 'var(--color-done)', glyph: '✓', hint: '做成了' },
  failed: { label: '失败', color: 'var(--color-failed)', glyph: '✕', hint: '没做成' },
  parked: { label: '搁置', color: 'var(--color-parked)', glyph: '‖', hint: '先放一放' },
  dropped: { label: '放弃', color: 'var(--color-draft)', glyph: '⌀', hint: '不做了' },
}

export const BUG_STATUS: Record<
  BugStatus,
  { label: string; color: string; glyph: string }
> = {
  open: { label: '待修', color: 'var(--color-bug)', glyph: '!' },
  fixing: { label: '修复中', color: 'var(--color-doing)', glyph: '◐' },
  fixed: { label: '已修复', color: 'var(--color-done)', glyph: '✓' },
  verified: { label: '已验证', color: 'var(--color-done)', glyph: '✓✓' },
  wontfix: { label: '不修', color: 'var(--color-draft)', glyph: '⌀' },
}

export const SEVERITY: Record<Severity, { label: string; color: string }> = {
  low: { label: '低', color: 'var(--color-ink-400)' },
  normal: { label: '中', color: 'var(--color-parked)' },
  high: { label: '高', color: 'var(--color-failed)' },
  blocker: { label: '阻塞', color: 'var(--color-bug)' },
}

/** 计划状态允许的下一步流转。 */
export const PLAN_FLOW: Record<PlanStatus, PlanStatus[]> = {
  draft: ['doing', 'parked', 'dropped'],
  doing: ['done', 'failed', 'parked', 'dropped'],
  done: ['doing'],
  failed: ['doing', 'parked', 'dropped'],
  parked: ['doing', 'dropped'],
  dropped: ['draft', 'doing'],
}

export const BUG_FLOW: Record<BugStatus, BugStatus[]> = {
  open: ['fixing', 'fixed', 'wontfix'],
  fixing: ['fixed', 'open', 'wontfix'],
  fixed: ['verified', 'open'],
  verified: ['open'],
  wontfix: ['open'],
}

export const PLAN_COLUMNS: PlanStatus[] = ['draft', 'doing', 'done', 'failed']
