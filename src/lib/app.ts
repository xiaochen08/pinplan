import { invoke } from '@tauri-apps/api/core'

/** 退出整个应用（含托盘常驻进程）。 */
export function quitApp(): Promise<void> {
  return invoke<void>('quit_app')
}
