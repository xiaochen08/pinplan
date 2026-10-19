import { create } from 'zustand'
import * as repo from '@/lib/repo'
import type { Bug, BugStatus, Entity, Plan, PlanStatus, Project } from '@/lib/types'
import { broadcastChanged, emitCheckin, emitSettingsChanged } from '@/lib/bus'
import { inQuietHours, duration } from '@/lib/time'

export interface PomodoroState {
  phase: 'work' | 'break'
  running: boolean
  /** 剩余秒数 */
  remaining: number
  /** 当前阶段总秒数 */
  total: number
  /** 今日完成的番茄数 */
  completed: number
  /** 本轮计划 id，用于巡检时聚焦 */
  focusPlanId: number | null
}

export interface Notice {
  id: number
  text: string
  tone: 'ok' | 'warn' | 'bad' | 'info'
}

/** 番茄钟初始状态。 */
const emptyPomodoro = (work: number): PomodoroState => ({  phase: 'work',
  running: false,
  remaining: work * 60,
  total: work * 60,
  completed: 0,
  focusPlanId: null,
})

interface AppState {
  ready: boolean
  error: string | null

  plans: Plan[]
  bugs: Bug[]
  projects: Project[]
  settings: repo.Settings
  stats: repo.Stats

  tab: 'plan' | 'bug'
  view: 'list' | 'board'
  query: string
  planFilter: PlanStatus | 'all'
  bugFilter: BugStatus | 'all'
  selected: { entity: Entity; id: number } | null
  quickAddPulse: number
  settingsOpen: boolean

  pomodoro: PomodoroState
  notice: Notice | null
  /** 每条记录的图片张数，键是 `${entity}:${id}`，列表页用来显示图片角标 */
  attachmentCounts: Record<string, number>

  init: () => Promise<void>
  refresh: () => Promise<void>
  refreshAttachmentCounts: () => Promise<void>
  notify: (text: string, tone?: Notice['tone']) => void
  dismissNotice: () => void

  setTab: (t: 'plan' | 'bug') => void
  setView: (v: 'list' | 'board') => void
  setQuery: (q: string) => void
  setPlanFilter: (s: PlanStatus | 'all') => void
  setBugFilter: (s: BugStatus | 'all') => void
  select: (sel: { entity: Entity; id: number } | null) => void
  openSettings: (v: boolean) => void

  addPlan: (title: string) => Promise<void>
  addBug: (title: string) => Promise<void>
  movePlan: (id: number, status: PlanStatus) => Promise<void>
  fixBug: (id: number) => Promise<void>
  patchPlan: (id: number, patch: Partial<Plan>) => Promise<void>
  patchBug: (id: number, patch: Partial<Bug>) => Promise<void>
  removePlan: (id: number) => Promise<void>
  removeBug: (id: number) => Promise<void>

  updateSettings: (patch: Partial<repo.Settings>) => Promise<void>

  pomodoroStart: () => void
  pomodoroPause: () => void
  pomodoroReset: () => void
  pomodoroSkip: () => void
  tick: () => void
  triggerCheckin: (force?: boolean) => Promise<void>
}

let noticeSeq = 0
let refreshTimer: ReturnType<typeof setTimeout> | undefined

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  error: null,

  plans: [],
  bugs: [],
  projects: [],
  settings: repo.DEFAULT_SETTINGS,
  stats: {
    draft: 0,
    doing: 0,
    done: 0,
    failed: 0,
    parked: 0,
    dropped: 0,
    bugsOpen: 0,
    bugsFixed: 0,
  },

  tab: 'plan',
  view: 'list',
  query: '',
  planFilter: 'all',
  bugFilter: 'all',
  selected: null,
  quickAddPulse: 0,
  settingsOpen: false,

  pomodoro: emptyPomodoro(repo.DEFAULT_SETTINGS.pomodoro_work),
  notice: null,
  attachmentCounts: {},

  /* ---------------- 初始化 / 刷新 ---------------- */

  init: async () => {
    try {
      const settings = await repo.loadSettings()
      const [plans, bugs, projects, st] = await Promise.all([
        repo.listPlans(),
        repo.listBugs(),
        repo.listProjects(),
        repo.stats(),
      ])
      const attachmentCounts = await repo.attachmentCounts()
      set({
        settings,
        view: settings.view,
        plans,
        bugs,
        projects,
        stats: st,
        attachmentCounts,
        pomodoro: emptyPomodoro(settings.pomodoro_work),
        ready: true,
      })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), ready: true })
    }
  },

  refresh: async () => {
    const [plans, bugs, st] = await Promise.all([
      repo.listPlans(),
      repo.listBugs(),
      repo.stats(),
    ])
    set({ plans, bugs, stats: st })
  },

  refreshAttachmentCounts: async () => {
    set({ attachmentCounts: await repo.attachmentCounts() })
  },

  notify: (text, tone = 'info') => {
    const id = ++noticeSeq
    set({ notice: { id, text, tone } })
    setTimeout(() => {
      if (get().notice?.id === id) set({ notice: null })
    }, 2600)
  },

  dismissNotice: () => set({ notice: null }),

  /* ---------------- UI ---------------- */

  setTab: (tab) => set({ tab, selected: null }),
  setView: (view) => {
    set({ view })
    void repo.saveSetting('view', view)
  },
  setQuery: (query) => set({ query }),
  setPlanFilter: (planFilter) => set({ planFilter }),
  setBugFilter: (bugFilter) => set({ bugFilter }),
  select: (selected) => set({ selected }),
  openSettings: (settingsOpen) => set({ settingsOpen }),

  /* ---------------- 写操作 ---------------- */

  addPlan: async (title) => {
    const t = title.trim()
    if (!t) return
    const id = await repo.createPlan(t, { status: 'draft' })
    await get().refresh()
    void broadcastChanged()
    set({ quickAddPulse: 0 })
    get().notify('记下了，随时可以开工', 'ok')
    void id
  },

  addBug: async (title) => {
    const t = title.trim()
    if (!t) return
    await repo.createBug(t)
    await get().refresh()
    void broadcastChanged()
    get().notify('BUG 已记录', 'ok')
  },

  movePlan: async (id, status) => {
    await repo.setPlanStatus(id, status)
    await get().refresh()
    void broadcastChanged()
    const label = status === 'done' ? '标记成功' : status === 'failed' ? '标记失败' : '状态已更新'
    get().notify(label, status === 'done' ? 'ok' : status === 'failed' ? 'bad' : 'info')
  },

  fixBug: async (id) => {
    await repo.markBugFixed(id)
    await get().refresh()
    void broadcastChanged()
    get().notify('修好了 ✓', 'ok')
  },

  patchPlan: async (id, patch) => {
    await repo.updatePlan(id, patch as Record<string, unknown>)
    await get().refresh()
    void broadcastChanged()
  },

  patchBug: async (id, patch) => {
    await repo.updateBug(id, patch as Record<string, unknown>)
    await get().refresh()
    void broadcastChanged()
  },

  removePlan: async (id) => {
    await repo.deletePlan(id)
    set({ selected: null })
    await get().refresh()
    void broadcastChanged()
    get().notify('已删除', 'warn')
  },

  removeBug: async (id) => {
    await repo.deleteBug(id)
    set({ selected: null })
    await get().refresh()
    void broadcastChanged()
    get().notify('已删除', 'warn')
  },

  /* ---------------- 设置 ---------------- */

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    await repo.saveSettings(patch)
    void emitSettingsChanged()
    if (patch.pomodoro_work !== undefined && !get().pomodoro.running) {
      set({
        pomodoro: {
          ...get().pomodoro,
          remaining: next.pomodoro_work * 60,
          total: next.pomodoro_work * 60,
          phase: 'work',
        },
      })
    }
  },

  /* ---------------- 番茄钟 ---------------- */

  pomodoroStart: () => {
    const p = get().pomodoro
    set({ pomodoro: { ...p, running: true } })
  },

  pomodoroPause: () => set({ pomodoro: { ...get().pomodoro, running: false } }),

  pomodoroReset: () => {
    const { settings } = get()
    set({ pomodoro: emptyPomodoro(settings.pomodoro_work) })
  },

  pomodoroSkip: () => {
    const { settings, pomodoro } = get()
    const nextPhase = pomodoro.phase === 'work' ? 'break' : 'work'
    const secs = (nextPhase === 'work' ? settings.pomodoro_work : settings.pomodoro_break) * 60
    set({
      pomodoro: {
        ...pomodoro,
        phase: nextPhase,
        remaining: secs,
        total: secs,
        completed: nextPhase === 'break' ? pomodoro.completed + 1 : pomodoro.completed,
      },
    })
    if (nextPhase === 'break') void get().triggerCheckin()
  },

  tick: () => {
    const { pomodoro, settings } = get()
    if (!pomodoro.running) return

    const remaining = pomodoro.remaining - 1
    if (remaining > 0) {
      set({ pomodoro: { ...pomodoro, remaining } })
      return
    }

    if (pomodoro.phase === 'work') {
      const secs = settings.pomodoro_break * 60
      set({
        pomodoro: {
          ...pomodoro,
          phase: 'break',
          remaining: secs,
          total: secs,
          completed: pomodoro.completed + 1,
          running: true,
        },
      })
      get().notify('一个番茄完成，休息一下', 'ok')
      void get().triggerCheckin()
    } else {
      const secs = settings.pomodoro_work * 60
      set({
        pomodoro: {
          ...pomodoro,
          phase: 'work',
          remaining: secs,
          total: secs,
          running: true,
        },
      })
      get().notify('回到工作，继续推进', 'info')
    }
  },

  /* ---------------- 巡检追问 ---------------- */

  triggerCheckin: async (force = false) => {
    const { settings } = get()
    if (!settings.checkin_enabled && !force) return
    if (!force && inQuietHours(settings.quiet_start, settings.quiet_end)) return

    const candidates = await repo.checkinCandidates(1)
    let pick = candidates
    if (pick.length === 0 && force) {
      // 预览模式：没有「进行中」的条目时，拿最近更新的一条演示
      pick = (await repo.listPlans()).slice(0, 1)
    }
    if (pick.length === 0) {
      if (force) get().notify('还没有可追问的计划', 'warn')
      return
    }
    const plan = pick[0]

    const answers = await repo.recentAnswers(plan.id, 4)
    let streak = 0
    for (const a of answers) {
      if (a === 'still') streak += 1
      else break
    }

    const started = plan.started_at ? new Date(plan.started_at).getTime() : null
    const meta = started
      ? `已进行 ${duration((Date.now() - started) / 1000)}`
      : `最后更新 ${new Date(plan.updated_at).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })}`

    const question =
      streak >= 2
        ? '这条一直没动，要不要先搁置它？'
        : streak === 1
          ? '还在推进吗？'
          : '这条还在推进吗？'

    await emitCheckin({
      entity: 'plan',
      id: plan.id,
      title: plan.title,
      meta,
      question,
      streak,
    })
  },
}))

/** 合并高频刷新请求（多窗口广播时避免重复查询）。 */
export function refreshSoon() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => void useStore.getState().refresh(), 120)
}
