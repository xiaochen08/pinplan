import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { PomodoroSnapshot } from './types'

/** 窗口间通信的事件名。 */
export const EVT = {
  /** 托盘 / 全局快捷键：聚焦主窗并准备快速新增 */
  quickAdd: 'pinplan://quick-add',
  /** 主窗 → 巡检弹窗：请展示这条追问 */
  checkin: 'pinplan://checkin',
  /** 巡检弹窗 → 主窗：已回答，请刷新 */
  answered: 'pinplan://checkin-answered',
  /** 任意数据变更，通知其他窗口刷新 */
  changed: 'pinplan://data-changed',
  /** 设置变更 */
  settings: 'pinplan://settings-changed',
  /** 主窗 → 边缘小钉：番茄钟快照 */
  pomodoro: 'pinplan://pomodoro',
  /** 边缘小钉 → 主窗：打开设置面板 */
  openSettings: 'pinplan://open-settings',
} as const

export interface CheckinPayload {
  entity: 'plan'
  id: number
  title: string
  meta: string
  question: string
  streak: number
}

export const broadcastChanged = (): Promise<void> => emit(EVT.changed, { at: Date.now() })

export const emitCheckin = (payload: CheckinPayload): Promise<void> =>
  emit(EVT.checkin, payload)

export const emitAnswered = (): Promise<void> => emit(EVT.answered, { at: Date.now() })

export function onChanged(cb: () => void): Promise<UnlistenFn> {
  return listen(EVT.changed, () => cb())
}

export function onCheckin(cb: (payload: CheckinPayload) => void): Promise<UnlistenFn> {
  return listen<CheckinPayload>(EVT.checkin, (e) => cb(e.payload))
}

export function onQuickAdd(cb: (kind: string) => void): Promise<UnlistenFn> {
  return listen<string>(EVT.quickAdd, (e) => cb(e.payload))
}

/* ---------------- 番茄钟广播 ---------------- */

export const emitPomodoro = (snapshot: PomodoroSnapshot): Promise<void> =>
  emit(EVT.pomodoro, snapshot)

export function onPomodoro(cb: (snapshot: PomodoroSnapshot) => void): Promise<UnlistenFn> {
  return listen<PomodoroSnapshot>(EVT.pomodoro, (e) => cb(e.payload))
}

/* ---------------- 设置变更 ---------------- */

export const emitSettingsChanged = (): Promise<void> => emit(EVT.settings, { at: Date.now() })

export function onSettingsChanged(cb: () => void): Promise<UnlistenFn> {
  return listen(EVT.settings, () => cb())
}

/** 巡检追问触发时的提醒（小钉据此弹跳）。 */
export function onCheckinPing(cb: () => void): Promise<UnlistenFn> {
  return listen(EVT.checkin, () => cb())
}

/* ---------------- 边缘小钉发起的动作 ---------------- */

export const emitQuickAdd = (kind: 'plan' | 'bug'): Promise<void> =>
  emit(EVT.quickAdd, kind)

export const emitOpenSettings = (): Promise<void> =>
  emit(EVT.openSettings, { at: Date.now() })

export function onOpenSettings(cb: () => void): Promise<UnlistenFn> {
  return listen(EVT.openSettings, () => cb())
}
