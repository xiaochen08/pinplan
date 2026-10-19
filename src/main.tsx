import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './styles/global.css'
import { WidgetApp } from './windows/WidgetApp'
import { PopupApp } from './windows/PopupApp'
import { DockApp } from './windows/DockApp'

const label = getCurrentWindow().label
const root = document.getElementById('root')

// 屏蔽 WebView2 自带的浏览器右键菜单（返回 / 刷新 / 另存为 / 打印 / 共享）。
// 这是本地工具，不是网页，弹出浏览器菜单很违和。
// 需要自定义右键菜单的地方（如边缘小钉）在自己的 onContextMenu 里照常处理。
document.addEventListener('contextmenu', (e) => e.preventDefault())

if (root) {
  // 刻意不用 StrictMode：窗口级副作用（事件订阅、计时器）在开发模式下
  // 会被双调用，容易产生重复监听和重复写入。
  const App = label === 'popup' ? PopupApp : label === 'dock' ? DockApp : WidgetApp
  createRoot(root).render(<App />)
}
