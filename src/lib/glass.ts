import { invoke } from '@tauri-apps/api/core'
import type { GlassMode } from './repo'

/** 运行时切换主窗 / 巡检弹窗的玻璃底效果。 */
export function setGlassMode(mode: GlassMode): Promise<void> {
  return invoke<void>('set_glass_mode', { mode })
}

export const GLASS_LABEL: Record<GlassMode, string> = {
  acrylic: '亚克力',
  blur: '模糊',
  none: '关闭',
}
