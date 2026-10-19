import { execute, nowIso, one, select } from './db'
import type {
  Bug,
  BugStatus,
  Entity,
  EventRow,
  Plan,
  PlanStatus,
  Project,
  Severity,
} from './types'

/* ==================================================================
   时间线
   ================================================================== */

export async function logEvent(
  entity: Entity,
  entityId: number,
  kind: EventRow['kind'],
  from?: string | null,
  to?: string | null,
  note?: string | null,
): Promise<void> {
  await execute(
    `INSERT INTO event (entity, entity_id, kind, from_value, to_value, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entity, entityId, kind, from ?? null, to ?? null, note ?? null, nowIso()],
  )
}

export function listEvents(entity: Entity, id: number): Promise<EventRow[]> {
  return select<EventRow>(
    `SELECT * FROM event WHERE entity = ? AND entity_id = ? ORDER BY created_at DESC, id DESC`,
    [entity, id],
  )
}

export function recentEvents(limit = 60): Promise<EventRow[]> {
  return select<EventRow>(
    `SELECT * FROM event ORDER BY created_at DESC, id DESC LIMIT ?`,
    [limit],
  )
}

/** 主窗日志和导出需要完整历史，详情不应受最近条数限制。 */
export function listAllEvents(): Promise<EventRow[]> {
  return select<EventRow>(`SELECT * FROM event ORDER BY created_at DESC, id DESC`)
}

/* ==================================================================
   计划
   ================================================================== */

const PLAN_ORDER = `
  ORDER BY pinned DESC,
    CASE status
      WHEN 'doing' THEN 0
      WHEN 'draft' THEN 1
      WHEN 'parked' THEN 2
      WHEN 'done' THEN 3
      WHEN 'failed' THEN 4
      ELSE 5
    END,
    priority DESC,
    updated_at DESC`

export function listPlans(): Promise<Plan[]> {
  return select<Plan>(`SELECT * FROM plan ${PLAN_ORDER}`)
}

export function getPlan(id: number): Promise<Plan | null> {
  return one<Plan>(`SELECT * FROM plan WHERE id = ?`, [id])
}

/** 待巡检的计划：进行中且最久没动过的优先。 */
export function checkinCandidates(limit = 3): Promise<Plan[]> {
  return select<Plan>(
    `SELECT * FROM plan WHERE status = 'doing' ORDER BY updated_at ASC LIMIT ?`,
    [limit],
  )
}

export async function createPlan(
  title: string,
  extra: Partial<Pick<Plan, 'detail' | 'status' | 'priority' | 'expect' | 'project_id'>> = {},
): Promise<number> {
  const ts = nowIso()
  const status = extra.status ?? 'draft'
  const res = await execute(
    `INSERT INTO plan
       (project_id, title, detail, status, priority, expect, result, lesson, tags, refs,
        pinned, sort, created_at, updated_at, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, '', '', '[]', '[]', 0, 0, ?, ?, ?, NULL)`,
    [
      extra.project_id ?? null,
      title.trim(),
      extra.detail ?? '',
      status,
      extra.priority ?? 1,
      extra.expect ?? '',
      ts,
      ts,
      status === 'doing' ? ts : null,
    ],
  )
  const id = Number(res.lastInsertId ?? 0)
  await logEvent('plan', id, 'create', null, status)
  return id
}

const PLAN_FIELDS = new Set([
  'project_id',
  'title',
  'detail',
  'status',
  'priority',
  'expect',
  'result',
  'lesson',
  'tags',
  'refs',
  'pinned',
  'sort',
  'started_at',
  'finished_at',
])

export async function updatePlan(
  id: number,
  patch: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(patch).filter((k) => PLAN_FIELDS.has(k))
  if (keys.length === 0) return
  const sets = keys.map((k) => `${k} = ?`).join(', ')
  await execute(`UPDATE plan SET ${sets}, updated_at = ? WHERE id = ?`, [
    ...keys.map((k) => patch[k] as never),
    nowIso(),
    id,
  ])
}

export async function setPlanStatus(
  id: number,
  next: PlanStatus,
  note?: string,
): Promise<void> {
  const cur = await getPlan(id)
  if (!cur || cur.status === next) return
  const ts = nowIso()
  const patch: Record<string, unknown> = { status: next }
  if (next === 'doing') {
    if (!cur.started_at) patch.started_at = ts
    patch.finished_at = null
  }
  if (next === 'done' || next === 'failed' || next === 'dropped') {
    patch.finished_at = ts
  }
  await updatePlan(id, patch)
  await logEvent('plan', id, 'status', cur.status, next, note ?? null)
}

export async function togglePlanPin(id: number): Promise<void> {
  await execute(`UPDATE plan SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END WHERE id = ?`, [
    id,
  ])
}

export async function deletePlan(id: number): Promise<void> {
  await execute(`DELETE FROM event WHERE entity = 'plan' AND entity_id = ?`, [id])
  await execute(`DELETE FROM plan WHERE id = ?`, [id])
}

/* ==================================================================
   BUG
   ================================================================== */

const BUG_ORDER = `
  ORDER BY
    CASE status
      WHEN 'open' THEN 0
      WHEN 'fixing' THEN 1
      WHEN 'fixed' THEN 2
      WHEN 'verified' THEN 3
      ELSE 4
    END,
    CASE severity
      WHEN 'blocker' THEN 0
      WHEN 'high' THEN 1
      WHEN 'normal' THEN 2
      ELSE 3
    END,
    updated_at DESC`

export function listBugs(): Promise<Bug[]> {
  return select<Bug>(`SELECT * FROM bug ${BUG_ORDER}`)
}

export function getBug(id: number): Promise<Bug | null> {
  return one<Bug>(`SELECT * FROM bug WHERE id = ?`, [id])
}

export function countOpenBugs(): Promise<number> {
  return one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM bug WHERE status IN ('open', 'fixing')`,
  ).then((r) => r?.n ?? 0)
}

export async function createBug(
  title: string,
  extra: Partial<Pick<Bug, 'repro' | 'severity' | 'status' | 'project_id' | 'plan_id'>> = {},
): Promise<number> {
  const ts = nowIso()
  const status = extra.status ?? 'open'
  const res = await execute(
    `INSERT INTO bug
       (project_id, plan_id, title, repro, severity, status, fix_note, fix_commit,
        fixed_at, tags, refs, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '', '', NULL, '[]', '[]', ?, ?)`,
    [
      extra.project_id ?? null,
      extra.plan_id ?? null,
      title.trim(),
      extra.repro ?? '',
      extra.severity ?? 'normal',
      status,
      ts,
      ts,
    ],
  )
  const id = Number(res.lastInsertId ?? 0)
  await logEvent('bug', id, 'create', null, status)
  return id
}

const BUG_FIELDS = new Set([
  'project_id',
  'plan_id',
  'title',
  'repro',
  'severity',
  'status',
  'fix_note',
  'fix_commit',
  'fixed_at',
  'tags',
  'refs',
])

export async function updateBug(
  id: number,
  patch: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(patch).filter((k) => BUG_FIELDS.has(k))
  if (keys.length === 0) return
  const sets = keys.map((k) => `${k} = ?`).join(', ')
  await execute(`UPDATE bug SET ${sets}, updated_at = ? WHERE id = ?`, [
    ...keys.map((k) => patch[k] as never),
    nowIso(),
    id,
  ])
}

export async function setBugStatus(
  id: number,
  next: BugStatus,
  note?: string,
): Promise<void> {
  const cur = await getBug(id)
  if (!cur || cur.status === next) return
  const patch: Record<string, unknown> = { status: next }
  if (next === 'fixed' || next === 'verified') {
    patch.fixed_at = cur.fixed_at ?? nowIso()
  }
  if (next === 'open') {
    patch.fixed_at = null
  }
  await updateBug(id, patch)
  await logEvent('bug', id, 'status', cur.status, next, note ?? null)
}

/** 一键标记已修复。 */
export async function markBugFixed(
  id: number,
  opts: { note?: string; commit?: string } = {},
): Promise<void> {
  const cur = await getBug(id)
  if (!cur) return
  const patch: Record<string, unknown> = { status: 'fixed', fixed_at: nowIso() }
  if (opts.note !== undefined) patch.fix_note = opts.note
  if (opts.commit !== undefined) patch.fix_commit = opts.commit
  await updateBug(id, patch)
  await logEvent('bug', id, 'fix', cur.status, 'fixed', opts.note ?? null)
}

export async function deleteBug(id: number): Promise<void> {
  await execute(`DELETE FROM event WHERE entity = 'bug' AND entity_id = ?`, [id])
  await execute(`DELETE FROM bug WHERE id = ?`, [id])
}

/* ==================================================================
   项目
   ================================================================== */

export function listProjects(): Promise<Project[]> {
  return select<Project>(`SELECT * FROM project WHERE archived = 0 ORDER BY sort, id`)
}

export async function createProject(name: string, color = '#6366F1'): Promise<number> {
  const res = await execute(
    `INSERT INTO project (name, color, sort, archived, created_at) VALUES (?, ?, 0, 0, ?)`,
    [name.trim(), color, nowIso()],
  )
  return Number(res.lastInsertId ?? 0)
}

/* ==================================================================
   设置（key/value 单表）
   ================================================================== */

export type AccentName = 'indigo' | 'cyan' | 'amber' | 'violet' | 'signal'

/** 窗口玻璃底：亚克力最好看，模糊更省，关闭最省。 */
export type GlassMode = 'acrylic' | 'blur' | 'none'

/** 视觉主题：深色玻璃 / Swiss Editorial（米白纸面） */
export type ThemeName = 'glass' | 'swiss'

export interface Settings {
  accent: AccentName
  view: 'list' | 'board'
  pomodoro_work: number
  pomodoro_break: number
  checkin_enabled: boolean
  checkin_interval: number
  quiet_start: string
  quiet_end: string
  autostart: boolean
  always_on_top: boolean
  /** 是否显示边缘小钉 */
  dock_enabled: boolean
  /** 窗口玻璃底 */
  glass: GlassMode
  /** 视觉主题 */
  theme: ThemeName
}

export const DEFAULT_SETTINGS: Settings = {
  accent: 'indigo',
  view: 'list',
  pomodoro_work: 25,
  pomodoro_break: 5,
  checkin_enabled: true,
  checkin_interval: 45,
  quiet_start: '23:00',
  quiet_end: '09:00',
  autostart: false,
  always_on_top: true,
  dock_enabled: true,
  glass: 'acrylic',
  theme: 'glass',
}

type RawSettings = Record<string, string>

export async function loadSettings(): Promise<Settings> {
  const rows = await select<{ key: string; value: string }>(`SELECT key, value FROM setting`)
  const raw: RawSettings = {}
  for (const r of rows) raw[r.key] = r.value
  const num = (k: string, d: number) => {
    const v = Number(raw[k])
    return Number.isFinite(v) && v > 0 ? v : d
  }
  const bool = (k: string, d: boolean) =>
    raw[k] === undefined ? d : raw[k] === '1' || raw[k] === 'true'
  const accent = raw.accent as AccentName | undefined
  return {
    accent:
      accent && ['indigo', 'cyan', 'amber', 'violet', 'signal'].includes(accent)
        ? accent
        : DEFAULT_SETTINGS.accent,
    view: raw.view === 'board' ? 'board' : 'list',
    pomodoro_work: num('pomodoro_work', DEFAULT_SETTINGS.pomodoro_work),
    pomodoro_break: num('pomodoro_break', DEFAULT_SETTINGS.pomodoro_break),
    checkin_enabled: bool('checkin_enabled', DEFAULT_SETTINGS.checkin_enabled),
    checkin_interval: raw.checkin_interval === '0' ? 0 : num('checkin_interval', DEFAULT_SETTINGS.checkin_interval),
    quiet_start: raw.quiet_start ?? DEFAULT_SETTINGS.quiet_start,
    quiet_end: raw.quiet_end ?? DEFAULT_SETTINGS.quiet_end,
    autostart: bool('autostart', DEFAULT_SETTINGS.autostart),
    always_on_top: bool('always_on_top', DEFAULT_SETTINGS.always_on_top),
    dock_enabled: bool('dock_enabled', DEFAULT_SETTINGS.dock_enabled),
    glass:
      raw.glass === 'blur' || raw.glass === 'none' || raw.glass === 'acrylic'
        ? raw.glass
        : DEFAULT_SETTINGS.glass,
    theme: raw.theme === 'swiss' ? 'swiss' : 'glass',
  }
}

export async function saveSetting(key: string, value: string | number | boolean) {
  await execute(
    `INSERT INTO setting (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value)],
  )
}

export async function saveSettings(patch: Partial<Settings>) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    await saveSetting(k, v as string | number | boolean)
  }
}

/* ==================================================================
   巡检记录
   ================================================================== */

export async function logCheckin(
  entity: Entity | null,
  entityId: number | null,
  question: string,
  answer: string,
): Promise<void> {
  await execute(
    `INSERT INTO checkin (entity, entity_id, question, answer, answered_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entity, entityId, question, answer, nowIso(), nowIso()],
  )
}

/** 最近若干次针对某条计划的巡检答案，用于「连续还在做」的判断。 */
export async function recentAnswers(entityId: number, limit = 5): Promise<string[]> {
  const rows = await select<{ answer: string }>(
    `SELECT answer FROM checkin WHERE entity = 'plan' AND entity_id = ?
     ORDER BY id DESC LIMIT ?`,
    [entityId, limit],
  )
  return rows.map((r) => r.answer)
}

/* ==================================================================
   统计
   ================================================================== */

export interface Stats {
  draft: number
  doing: number
  done: number
  failed: number
  parked: number
  dropped: number
  bugsOpen: number
  bugsFixed: number
}

export async function stats(): Promise<Stats> {
  const rows = await select<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM plan GROUP BY status`,
  )
  const base: Stats = {
    draft: 0,
    doing: 0,
    done: 0,
    failed: 0,
    parked: 0,
    dropped: 0,
    bugsOpen: 0,
    bugsFixed: 0,
  }
  for (const r of rows) {
    if (r.status in base) base[r.status as keyof Stats] = r.n
  }
  const bugRows = await select<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM bug GROUP BY status`,
  )
  for (const r of bugRows) {
    if (r.status === 'open' || r.status === 'fixing') base.bugsOpen += r.n
    if (r.status === 'fixed' || r.status === 'verified') base.bugsFixed += r.n
  }
  return base
}

/* ==================================================================
   图片附件
   ================================================================== */

export interface Attachment {
  id: number
  entity: 'plan' | 'bug'
  entity_id: number
  name: string
  mime: string
  width: number
  height: number
  bytes: number
  /** data URL，直接给 <img src> 用 */
  data: string
  created_at: string
}

export async function listAttachments(
  entity: 'plan' | 'bug',
  entityId: number,
): Promise<Attachment[]> {
  return select<Attachment>(
    `SELECT id, entity, entity_id, name, mime, width, height, bytes, data, created_at
       FROM attachment
      WHERE entity = ? AND entity_id = ?
      ORDER BY created_at, id`,
    [entity, entityId],
  )
}

export async function addAttachment(
  a: Omit<Attachment, 'id' | 'created_at'>,
): Promise<number> {
  await execute(
    `INSERT INTO attachment (entity, entity_id, name, mime, width, height, bytes, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.entity, a.entity_id, a.name, a.mime, a.width, a.height, a.bytes, a.data, nowIso()],
  )
  const row = await one<{ id: number }>(`SELECT last_insert_rowid() AS id`)
  return row?.id ?? 0
}

export async function removeAttachment(id: number): Promise<void> {
  await execute(`DELETE FROM attachment WHERE id = ?`, [id])
}

/** 某条记录有几张图（列表页要显示角标）。 */
export async function attachmentCounts(): Promise<Record<string, number>> {
  const rows = await select<{ entity: string; entity_id: number; n: number }>(
    `SELECT entity, entity_id, COUNT(*) AS n FROM attachment GROUP BY entity, entity_id`,
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[`${r.entity}:${r.entity_id}`] = r.n
  return out
}

export type { Severity }
