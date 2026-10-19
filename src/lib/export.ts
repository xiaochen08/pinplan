import { invoke } from '@tauri-apps/api/core'
import type { Bug, Plan, EventRow } from './types'
import { BUG_STATUS, PLAN_STATUS, SEVERITY } from './types'
import { absTime } from './time'

const PRIORITY: Record<number, string> = { 0: '低', 1: '中', 2: '高', 3: '紧急' }

function planBlock(p: Plan): string {
  const lines = [`### ${p.title}`, '']
  lines.push(`- 状态：${PLAN_STATUS[p.status].label} · 优先级 ${PRIORITY[p.priority] ?? '中'}`)
  lines.push(`- 创建：${absTime(p.created_at)}　更新：${absTime(p.updated_at)}`)
  if (p.started_at) lines.push(`- 开始：${absTime(p.started_at)}`)
  if (p.finished_at) lines.push(`- 结束：${absTime(p.finished_at)}`)
  if (p.expect) lines.push(`- **预期**：${p.expect}`)
  if (p.result) lines.push(`- **实际**：${p.result}`)
  if (p.lesson) lines.push(`- **复盘**：${p.lesson}`)
  if (p.detail) lines.push(`- 备注：${p.detail}`)
  const tags: string[] = safeJson(p.tags)
  if (tags.length) lines.push(`- 标签：${tags.map((t) => `#${t}`).join(' ')}`)
  lines.push('')
  return lines.join('\n')
}

function bugLine(b: Bug): string {
  const box = b.status === 'fixed' || b.status === 'verified' ? 'x' : ' '
  const sev = SEVERITY[b.severity]?.label ?? '中'
  const tail =
    b.status === 'fixed' || b.status === 'verified'
      ? `　已修复 ${absTime(b.fixed_at)}${b.fix_note ? ` — ${b.fix_note}` : ''}`
      : `　${BUG_STATUS[b.status].label} · 严重度 ${sev}`
  return `- [${box}] ${b.title}${tail}`
}

function safeJson(raw: string): string[] {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export function toMarkdown(plans: Plan[], bugs: Bug[]): string {
  const now = new Date()
  const out: string[] = [
    '# PinPlan 开发日志',
    '',
    `> 导出时间：${now.toLocaleString('zh-CN')}`,
    `> 计划 ${plans.length} 条 · BUG ${bugs.length} 条`,
    '',
  ]

  const groups: [string, Plan['status'][]][] = [
    ['进行中', ['doing']],
    ['草案', ['draft']],
    ['成功', ['done']],
    ['失败', ['failed']],
    ['搁置', ['parked']],
    ['已放弃', ['dropped']],
  ]

  for (const [title, statuses] of groups) {
    const items = plans.filter((p) => statuses.includes(p.status))
    if (items.length === 0) continue
    out.push(`## ${title}（${items.length}）`, '')
    for (const p of items) out.push(planBlock(p))
  }

  if (bugs.length > 0) {
    out.push('## BUG', '')
    const open = bugs.filter((b) => b.status === 'open' || b.status === 'fixing')
    const closed = bugs.filter((b) => b.status !== 'open' && b.status !== 'fixing')
    if (open.length) {
      out.push(`### 待处理（${open.length}）`, '')
      for (const b of open) out.push(bugLine(b))
      out.push('')
    }
    if (closed.length) {
      out.push(`### 已处理（${closed.length}）`, '')
      for (const b of closed) out.push(bugLine(b))
      out.push('')
    }
  }

  return out.join('\n')
}

export function toJson(plans: Plan[], bugs: Bug[], events: EventRow[]): string {
  return JSON.stringify(
    {
      app: 'PinPlan',
      version: 1,
      exportedAt: new Date().toISOString(),
      plans,
      bugs,
      events,
    },
    null,
    2,
  )
}

/** 保存到「我的文档 / PinPlan」，返回绝对路径。 */
export function saveExport(filename: string, content: string): Promise<string> {
  return invoke<string>('save_export', { filename, content })
}

export function openPath(path: string): Promise<void> {
  return invoke<void>('open_path', { path })
}
