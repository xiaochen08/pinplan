import { useSyncExternalStore } from 'react'
import * as repo from '@/lib/repo'
import { broadcastChanged, emitCheckin, emitPomodoro } from '@/lib/bus'
import { nowIso } from './time'
import { inQuietHours } from '@/lib/time'
import { emitSettingsChanged } from '@/lib/bus'
import { setDockVisible } from '@/lib/window'
import type { Bug, BugStatus, CheckinAnswer, Entity, EventRow, Plan, PlanStatus, Project, Severity } from './types'
import type { Bug as DbBug, EventRow as DbEventRow, Plan as DbPlan, Project as DbProject } from '@/lib/types'
import { BUG_STATUS, PLAN_STATUS } from './types'

export type Theme = 'paper' | 'night'
export type View = 'plans' | 'bugs' | 'journal'
export type PlanFilter = 'all' | 'active' | PlanStatus
export type BugFilter = 'all' | 'active' | BugStatus
export type Selection = { kind: Entity; id: number } | null

export interface Settings {
  theme: Theme
  accent: repo.AccentName
  glass: repo.GlassMode
  alwaysOnTop: boolean
  quietStart: string
  quietEnd: string
  pomodoroWork: number
  pomodoroBreak: number
  checkinEnabled: boolean
  checkinInterval: number
  edgePin: boolean
}
export interface Pomodoro {
  running: boolean
  phase: 'work' | 'break'
  remaining: number
  total: number
  completed: number
  endsAt: number | null
}
export interface Toast { id: number; message: string; tone?: string; undo?: () => void }
export interface UI {
  view: View
  planFilter: PlanFilter
  bugFilter: BugFilter
  project: number | null
  selected: Selection
  mode: 'full' | 'mini'
  hidden: boolean
  search: string
  layout: 'list' | 'board'
  settingsOpen: boolean
  checkin: number | null
  quickFocus: number
  pinY: number
}
interface Data { plans: Plan[]; bugs: Bug[]; events: EventRow[]; projects: Project[]; seq: number }
export interface State extends Data { ready: boolean; error: string | null; settings: Settings; ui: UI; pomodoro: Pomodoro; toast: Toast | null; lastCheckinAt: number }

const DEFAULT_SETTINGS: Settings = { theme: 'paper', accent: 'indigo', glass: 'acrylic', alwaysOnTop: true, quietStart: '23:00', quietEnd: '09:00', pomodoroWork: 25, pomodoroBreak: 5, checkinEnabled: true, checkinInterval: 45, edgePin: true }
const DEFAULT_UI: UI = { view: 'plans', planFilter: 'all', bugFilter: 'all', project: null, selected: null, mode: 'full', hidden: false, search: '', layout: 'list', settingsOpen: false, checkin: null, quickFocus: 0, pinY: 0.36 }
const freshPomodoro = (work: number): Pomodoro => ({ running: false, phase: 'work', remaining: work * 60, total: work * 60, completed: 0, endsAt: null })

const parseJsonArray = (value: string | string[] | null | undefined): string[] => {
  if (Array.isArray(value)) return value
  try { const parsed = JSON.parse(value ?? '[]'); return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [] } catch { return [] }
}
const fromDbPlan = (p: DbPlan): Plan => ({ ...p, tags: parseJsonArray(p.tags), pinned: Boolean(p.pinned) })
const fromDbBug = (b: DbBug): Bug => ({ ...b })
const fromDbProject = (p: DbProject): Project => ({ id: p.id, name: p.name, color: p.color })
const fromDbEvent = (event: DbEventRow): EventRow => ({ ...event })
const toDbPlanPatch = (patch: Partial<Plan>): Record<string, unknown> => {
  const next = { ...patch } as Record<string, unknown>
  if (Array.isArray(next.tags)) next.tags = JSON.stringify(next.tags)
  if (typeof next.pinned === 'boolean') next.pinned = next.pinned ? 1 : 0
  delete next.id; delete next.created_at; delete next.updated_at
  return next
}
function initialState(): State { return { plans: [], bugs: [], projects: [], events: [], seq: 1, ready: false, error: null, settings: DEFAULT_SETTINGS, ui: DEFAULT_UI, pomodoro: freshPomodoro(DEFAULT_SETTINGS.pomodoroWork), toast: null, lastCheckinAt: Date.now() } }

let state: State = initialState()
const listeners = new Set<() => void>()
export const getState = () => state
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
export function useStore<T>(selector: (s: State) => T): T { return useSyncExternalStore(subscribe, () => selector(state)) }
function notify() { listeners.forEach((listener) => listener()) }
export function setState(fn: (s: State) => Partial<State>) { state = { ...state, ...fn(state) }; notify() }
export function setUI(patch: Partial<UI>) {
  setState((s) => ({ ui: { ...s.ui, ...patch } }))
  if (patch.layout) void persist(() => repo.saveSetting('view', patch.layout!))
}

export async function initStore() {
  try {
    const [dbPlans, dbBugs, dbProjects, events, dbSettings] = await Promise.all([repo.listPlans(), repo.listBugs(), repo.listProjects(), repo.listAllEvents(), repo.loadSettings()])
    const plans = dbPlans.map(fromDbPlan); const bugs = dbBugs.map(fromDbBug)
    const settings: Settings = { ...DEFAULT_SETTINGS, theme: dbSettings.theme === 'swiss' ? 'paper' : 'night', accent: dbSettings.accent, glass: dbSettings.glass, alwaysOnTop: dbSettings.always_on_top, quietStart: dbSettings.quiet_start, quietEnd: dbSettings.quiet_end, checkinInterval: dbSettings.checkin_interval, pomodoroWork: dbSettings.pomodoro_work, pomodoroBreak: dbSettings.pomodoro_break, checkinEnabled: dbSettings.checkin_enabled, edgePin: dbSettings.dock_enabled }
    setState((s) => ({ plans, bugs, projects: dbProjects.map(fromDbProject), events: events.map(fromDbEvent), seq: Math.max(0, ...plans.map((p) => p.id), ...bugs.map((b) => b.id), ...events.map((e) => e.id)) + 1, settings, ready: true, error: null, ui: { ...s.ui, layout: dbSettings.view }, pomodoro: freshPomodoro(settings.pomodoroWork) }))
  } catch (error) { setState(() => ({ ready: true, error: error instanceof Error ? error.message : String(error) })) }
}
export async function refreshFromDb(force = false) {
  if (pendingWrites && !force) return
  const revision = writeRevision
  const [plans, bugs, events] = await Promise.all([repo.listPlans(), repo.listBugs(), repo.listAllEvents()])
  if (revision !== writeRevision) return
  setState((s) => ({ plans: plans.map(fromDbPlan), bugs: bugs.map(fromDbBug), events: events.map(fromDbEvent), seq: s.seq + 1 }))
}

let writes: Promise<unknown> = Promise.resolve()
let writeRevision = 0
let pendingWrites = 0
function persist<T>(operation: () => Promise<T>): Promise<T | null> {
  const revision = ++writeRevision
  pendingWrites++
  const job = writes.then(async () => {
    try {
      const value = await operation()
      if (revision === writeRevision) await refreshFromDb(true)
      await broadcastChanged()
      return value
    } catch (error) {
      if (revision === writeRevision) await refreshFromDb(true).catch(() => undefined)
      toast(`保存失败：${error instanceof Error ? error.message : String(error)}`, { tone: 'var(--s-failed)' })
      return null
    } finally { pendingWrites-- }
  })
  writes = job
  return job
}

let toastSeq = 0; let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(message: string, opts: { tone?: string; undo?: () => void } = {}) { clearTimeout(toastTimer); const id = ++toastSeq; setState(() => ({ toast: { id, message, ...opts } })); toastTimer = setTimeout(() => state.toast?.id === id && setState(() => ({ toast: null })), 5200) }
export const dismissToast = () => setState(() => ({ toast: null }))
function parseQuick(raw: string) { const tags: string[] = []; let priority: number | undefined; let title = raw.replace(/#([^\s#]+)/g, (_, tag: string) => (tags.push(tag), '')); if (/(^|\s)!+(\s|$)/.test(title) || /！/.test(title)) { priority = 2; title = title.replace(/(^|\s)!+(?=\s|$)/g, ' ').replace(/！/g, '') } return { title: title.replace(/\s+/g, ' ').trim(), tags, priority } }

export async function createPlan(raw: string, extra: Partial<Plan> = {}): Promise<number | null> {
  const { title, tags, priority } = parseQuick(raw)
  if (!title) return null
  const project = extra.project_id ?? state.ui.project
  const id = await persist(async () => {
    const id = await repo.createPlan(title, { status: extra.status ?? 'draft', priority: priority ?? extra.priority ?? 1, detail: extra.detail, expect: extra.expect, project_id: project })
    if (tags.length) await repo.updatePlan(id, { tags: JSON.stringify(tags) })
    return id
  })
  if (id) toast('记下了一条计划')
  return id
}
export function updatePlan(id: number, patch: Partial<Plan>) {
  setState((s) => ({ plans: s.plans.map((p) => p.id === id ? { ...p, ...patch, updated_at: nowIso() } : p) }))
  void persist(() => repo.updatePlan(id, toDbPlanPatch(patch)))
}
export function setPlanStatus(id: number, next: PlanStatus, note?: string, opts: { silent?: boolean } = {}) {
  const cur = state.plans.find((p) => p.id === id)
  if (!cur || cur.status === next) return
  const ts = nowIso()
  const patch: Partial<Plan> = { status: next }
  if (next === 'doing') { patch.started_at = cur.started_at ?? ts; patch.finished_at = null }
  if (next === 'done' || next === 'failed' || next === 'dropped') patch.finished_at = ts
  setState((s) => ({ plans: s.plans.map((p) => p.id === id ? { ...p, ...patch, updated_at: ts } : p) }))
  void persist(async () => { await repo.setPlanStatus(id, next, note); if (!opts.silent) toast(`「${cur.title}」→ ${PLAN_STATUS[next].label}`) })
}
export function togglePin(id: number) {
  const pinned = !state.plans.find((p) => p.id === id)?.pinned
  setState((s) => ({ plans: s.plans.map((p) => p.id === id ? { ...p, pinned } : p) }))
  void persist(() => repo.updatePlan(id, { pinned: pinned ? 1 : 0 }))
}
export function deletePlan(id: number) {
  void persist(async () => {
    await repo.deletePlan(id)
    if (state.ui.selected?.kind === 'plan' && state.ui.selected.id === id) setUI({ selected: null })
    toast('计划已删除')
  })
}
export async function createBug(raw: string, severity: Severity = 'normal'): Promise<number | null> {
  const { title, priority } = parseQuick(raw)
  if (!title) return null
  const project = state.ui.project
  const id = await persist(() => repo.createBug(title, { severity: priority === 2 ? 'high' : severity, project_id: project }))
  if (id) toast('收容了一个 BUG')
  return id
}
export function updateBug(id: number, patch: Partial<Bug>) {
  setState((s) => ({ bugs: s.bugs.map((b) => b.id === id ? { ...b, ...patch, updated_at: nowIso() } : b) }))
  void persist(() => repo.updateBug(id, patch as Record<string, unknown>))
}
export function setBugStatus(id: number, next: BugStatus) {
  const cur = state.bugs.find((b) => b.id === id)
  if (!cur || cur.status === next) return
  setState((s) => ({ bugs: s.bugs.map((b) => b.id === id ? { ...b, status: next, updated_at: nowIso() } : b) }))
  void persist(async () => { await repo.setBugStatus(id, next); toast(`BUG「${cur.title}」→ ${BUG_STATUS[next].label}`) })
}
export function deleteBug(id: number) {
  void persist(async () => {
    await repo.deleteBug(id)
    if (state.ui.selected?.kind === 'bug' && state.ui.selected.id === id) setUI({ selected: null })
    toast('BUG 已删除')
  })
}

export function checkinCandidate(s: State = state): Plan | null { return [...s.plans.filter((p) => p.status === 'doing')].sort((a, b) => a.updated_at.localeCompare(b.updated_at))[0] ?? null }
export function checkinStreak(planId: number, s: State = state): number { let n = 0; for (const event of s.events.filter((e) => e.entity === 'plan' && e.entity_id === planId)) { if (event.kind === 'status' || event.kind === 'create') break; if (event.kind === 'checkin' && /^(still|stuck)/.test(event.note ?? '')) n += 1 } return n }
export async function triggerCheckin(force = false) {
  if (!force && (!state.settings.checkinEnabled || inQuietHours(state.settings.quietStart, state.settings.quietEnd))) return
  const plan = checkinCandidate()
  if (!plan) { if (force) toast('没有进行中的计划，无需巡检'); return }
  setState((s) => ({ lastCheckinAt: Date.now(), ui: { ...s.ui, checkin: plan.id } }))
  try {
    const answers = await repo.recentAnswers(plan.id, 4)
    let streak = 0
    for (const answer of answers) { if (/^(still|stuck)/.test(answer)) streak++; else break }
    await emitCheckin({ entity: 'plan', id: plan.id, title: plan.title, meta: '进行中', question: '这条还在推进吗？', streak })
  } catch (error) { toast(`巡检失败：${String(error)}`) }
}
export function answerCheckin(planId: number, key: CheckinAnswer, note: string) {
  void persist(() => repo.logCheckin('plan', planId, '这条还在推进吗？', note.trim() ? `${key}｜${note.trim()}` : key))
  if (key === 'done') setPlanStatus(planId, 'done')
  if (key === 'drop') setPlanStatus(planId, 'dropped')
  if (key === 'park') setPlanStatus(planId, 'parked')
  setUI({ checkin: null })
}
export const dismissCheckin = () => setUI({ checkin: null })

export function pomodoroStart() { setState((s) => ({ pomodoro: { ...s.pomodoro, running: true, endsAt: Date.now() + s.pomodoro.remaining * 1000 } })) }
export function pomodoroPause() { setState((s) => ({ pomodoro: { ...s.pomodoro, running: false, endsAt: null } })) }
export function pomodoroReset() { setState((s) => ({ pomodoro: { ...freshPomodoro(s.settings.pomodoroWork), completed: s.pomodoro.completed } })) }
function advancePhase(auto: boolean) { const p = state.pomodoro; const phase: Pomodoro['phase'] = p.phase === 'work' ? 'break' : 'work'; const total = (phase === 'work' ? state.settings.pomodoroWork : state.settings.pomodoroBreak) * 60; const next: Pomodoro = { ...p, phase, total, remaining: total, running: auto, endsAt: auto ? Date.now() + total * 1000 : null, completed: phase === 'break' ? p.completed + 1 : p.completed }; setState(() => ({ pomodoro: next })); void emitPomodoro(next); if (phase === 'break') triggerCheckin(); toast(phase === 'break' ? '专注结束，休息一下' : '休息结束，准备下一轮') }
export const pomodoroSkip = () => advancePhase(state.pomodoro.running)
export function pomodoroTick() { if (state.ready && !state.error && state.settings.checkinInterval > 0 && Date.now() - state.lastCheckinAt >= state.settings.checkinInterval * 60_000) { setState(() => ({ lastCheckinAt: Date.now() })); void triggerCheckin() } const p = state.pomodoro; if (!p.running || !p.endsAt) return; const remaining = Math.max(0, Math.round((p.endsAt - Date.now()) / 1000)); if (remaining === 0) return advancePhase(true); if (remaining !== p.remaining) { const next = { ...p, remaining }; setState(() => ({ pomodoro: next })); void emitPomodoro(next) } }

export function updateSettings(patch: Partial<Settings>) {
  const previous = state.settings
  const next = { ...previous, ...patch }
  setState((s) => ({
    settings: next,
    pomodoro: patch.pomodoroWork && !s.pomodoro.running ? freshPomodoro(next.pomodoroWork) : s.pomodoro,
  }))
  const dbPatch: Partial<repo.Settings> = {}
  if (patch.theme !== undefined) dbPatch.theme = patch.theme === 'paper' ? 'swiss' : 'glass'
  if (patch.accent !== undefined) dbPatch.accent = patch.accent
  if (patch.glass !== undefined) dbPatch.glass = patch.glass
  if (patch.alwaysOnTop !== undefined) dbPatch.always_on_top = patch.alwaysOnTop
  if (patch.quietStart !== undefined) dbPatch.quiet_start = patch.quietStart
  if (patch.quietEnd !== undefined) dbPatch.quiet_end = patch.quietEnd
  if (patch.pomodoroWork !== undefined) dbPatch.pomodoro_work = patch.pomodoroWork
  if (patch.pomodoroBreak !== undefined) dbPatch.pomodoro_break = patch.pomodoroBreak
  if (patch.checkinEnabled !== undefined) dbPatch.checkin_enabled = patch.checkinEnabled
  if (patch.edgePin !== undefined) dbPatch.dock_enabled = patch.edgePin
  if (patch.checkinInterval !== undefined) dbPatch.checkin_interval = patch.checkinInterval
  void persist(async () => {
    try {
      await repo.saveSettings(dbPatch)
      await emitSettingsChanged()
      if (patch.edgePin !== undefined) await setDockVisible(patch.edgePin)
    } catch (error) {
      // Recover actual saved settings even if a later setting in this batch failed.
      const saved = await repo.loadSettings()
      if (state.settings === next) setState(() => ({ settings: {
        ...previous, theme: saved.theme === 'swiss' ? 'paper' : 'night',
        accent: saved.accent, glass: saved.glass, alwaysOnTop: saved.always_on_top,
        quietStart: saved.quiet_start, quietEnd: saved.quiet_end,
        pomodoroWork: saved.pomodoro_work, pomodoroBreak: saved.pomodoro_break,
        checkinEnabled: saved.checkin_enabled, edgePin: saved.dock_enabled,
        checkinInterval: saved.checkin_interval,
      } }))
      throw error
    }
  })
}
export function resetDemo() { toast('桌面版使用 SQLite，未覆盖现有数据') }
export function clearAll() {
  void persist(async () => {
    for (const plan of state.plans) await repo.deletePlan(plan.id)
    for (const bug of state.bugs) await repo.deleteBug(bug.id)
    setUI({ selected: null })
    toast('已清空全部记录')
  })
}
export function importData(_json: string): boolean { toast('桌面版暂不支持直接导入演示 JSON'); return false }
export function select(sel: Selection) { setUI({ selected: sel, mode: 'full' }) }
export function focusQuickAdd(view: 'plans' | 'bugs') { setState((s) => ({ ui: { ...s.ui, view, mode: 'full', hidden: false, quickFocus: s.ui.quickFocus + 1 } })) }
