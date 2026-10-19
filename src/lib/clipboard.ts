import { BUG_STATUS, PLAN_STATUS, SEVERITY, type Bug, type Plan } from './types'

/**
 * 复制纯文本到剪贴板。
 *
 * Tauri 的窗口走自定义协议，`navigator.clipboard` 经常因为不是安全上下文而不可用，
 * 所以保留一条 execCommand 的老路作为兜底。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 落到下面的回退路径 */
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}

/** 计划 → 可直接贴进聊天/周报的纯文本。 */export function planText(p: Plan): string {
  const out = [`【${PLAN_STATUS[p.status].label}】${p.title}`]
  if (p.priority >= 2) out.push(`优先级：${p.priority === 3 ? '紧急' : '高'}`)
  if (p.expect.trim()) out.push(`期望：${p.expect.trim()}`)
  if (p.result.trim()) out.push(`结果：${p.result.trim()}`)
  if (p.lesson.trim()) out.push(`复盘：${p.lesson.trim()}`)
  if (p.detail.trim()) out.push(`备注：${p.detail.trim()}`)
  return out.join('\n')
}

/** BUG → 可直接贴进聊天/issue 的纯文本。 */
export function bugText(b: Bug): string {
  const out = [`【${BUG_STATUS[b.status].label} · ${SEVERITY[b.severity].label}】${b.title}`]
  if (b.repro.trim()) out.push(`复现：${b.repro.trim()}`)
  if (b.fix_note.trim()) out.push(`修复：${b.fix_note.trim()}`)
  if (b.fix_commit.trim()) out.push(`提交：${b.fix_commit.trim()}`)
  return out.join('\n')
}
