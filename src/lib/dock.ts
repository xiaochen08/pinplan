import { invoke } from '@tauri-apps/api/core'

export type DockEdge = 'left' | 'right' | 'top' | 'free'
export type DockSide = 'left' | 'right'
export type DockMode = 'tucked' | 'icon' | 'bubble' | 'menu'

export interface DockState {
  edge: DockEdge
  /** 贴边时是沿边偏移（物理像素），-1 表示居中 */
  offset: number
  mode: DockMode
  /** 自由悬浮时图标左上角坐标 */
  x: number
  y: number
}

export interface DockRect extends DockState {
  w: number
  h: number
  scale: number
  /** 气泡 / 菜单朝哪边展开 */
  side: DockSide
  iconX?: number
  iconY?: number
}

/** 读取上次记住的边缘与位置。 */
export function dockLoad(): Promise<DockState> {
  return invoke<DockState>('dock_load')
}

/** 贴边模式：按边缘/偏移/形态重新计算并应用窗口几何。 */
export function dockPlace(edge: DockEdge, offset: number, mode: DockMode): Promise<DockRect> {
  return invoke<DockRect>('dock_place', { edge, offset, mode })
}

/** 自由悬浮模式：图标停在放下的位置，不贴边。 */
export function dockPlaceFree(x: number, y: number, mode: DockMode): Promise<DockRect> {
  return invoke<DockRect>('dock_place_free', { x, y, mode })
}

/** 逻辑尺寸，供布局使用 */
export const DOCK_ICON = 56
export const DOCK_BUBBLE_LEN = 214
export const DOCK_TUCK_THICK = 14
export const DOCK_TUCK_LEN = 44
/** 离边缘多近才吸附（逻辑像素） */
export const SNAP_THRESHOLD = 90
