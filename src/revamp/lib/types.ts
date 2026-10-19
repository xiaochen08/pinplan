/** 领域模型与状态机。与桌面版 SQLite 表结构保持一致，方便日后回迁。 */

export type PlanStatus = 'draft' | 'doing' | 'done' | 'failed' | 'parked' | 'dropped'
export type BugStatus = 'open' | 'fixing' | 'fixed' | 'verified' | 'wontfix'
export type Severity = 'low' | 'normal' | 'high' | 'blocker'
export type Entity = 'plan' | 'bug'
export type CheckinAnswer = 'still' | 'stuck' | 'park' | 'done' | 'drop'

export interface Plan {
  id: number
  project_id: number | null
  title: string
  detail: string
  status: PlanStatus
  /** 0 低 · 1 中 · 2 高 */
  priority: number
  expect: string
  result: string
  lesson: string
  tags: string[]
  pinned: boolean
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
}

interface StatusMeta {
  label: string
  en: string
  color: string
  hint: string
}

export const PLAN_STATUS: Record<PlanStatus, StatusMeta> = {
  draft: { label: '草案', en: 'DRAFT', color: 'var(--s-draft)', hint: '还没开始' },
  doing: { label: '进行中', en: 'DOING', color: 'var(--s-doing)', hint: '正在推进' },
  done: { label: '成功', en: 'DONE', color: 'var(--s-done)', hint: '做成了' },
  failed: { label: '失败', en: 'FAILED', color: 'var(--s-failed)', hint: '没做成' },
  parked: { label: '搁置', en: 'PARKED', color: 'var(--s-parked)', hint: '先放一放' },
  dropped: { label: '放弃', en: 'DROPPED', color: 'var(--s-dropped)', hint: '不做了' },
}

export const BUG_STATUS: Record<BugStatus, StatusMeta> = {
  open: { label: '待修', en: 'OPEN', color: 'var(--s-bug)', hint: '还没动' },
  fixing: { label: '修复中', en: 'FIXING', color: 'var(--s-doing)', hint: '正在修' },
  fixed: { label: '已修复', en: 'FIXED', color: 'var(--s-done)', hint: '修好了' },
  verified: { label: '已验证', en: 'VERIFIED', color: 'var(--s-done)', hint: '验证通过' },
  wontfix: { label: '不修', en: "WON'T FIX", color: 'var(--s-dropped)', hint: '决定不修' },
}

export const SEVERITY: Record<Severity, { label: string; short: string; rank: number }> = {
  blocker: { label: '阻塞', short: 'S0', rank: 0 },
  high: { label: '高危', short: 'S1', rank: 1 },
  normal: { label: '中', short: 'S2', rank: 2 },
  low: { label: '低', short: 'S3', rank: 3 },
}

export const PRIORITY = ['低', '中', '高'] as const

/** 计划允许的下一步流转。 */
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

export const PLAN_ORDER: PlanStatus[] = ['doing', 'draft', 'parked', 'failed', 'done', 'dropped']
export const BOARD_COLUMNS: PlanStatus[] = ['draft', 'doing', 'parked', 'done', 'failed', 'dropped']

export const isClosedPlan = (s: PlanStatus) => s === 'done' || s === 'failed' || s === 'dropped'
export const isOpenBug = (s: BugStatus) => s === 'open' || s === 'fixing'
