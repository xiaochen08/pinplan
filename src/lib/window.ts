import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/** 显隐主窗（小钉单击时调用）。 */
export async function toggleMain(): Promise<void> {
  const win = await WebviewWindow.getByLabel('main')
  if (!win) return
  if (await win.isVisible()) {
    await win.hide()
  } else {
    await win.show()
    await win.setFocus()
  }
}

/** 显示 / 隐藏边缘小钉。 */
export async function setDockVisible(visible: boolean): Promise<void> {
  const win = await WebviewWindow.getByLabel('dock')
  if (!win) return
  if (visible) await win.show()
  else await win.hide()
}
