import type { State } from './store'
import { BUG_STATUS, PLAN_STATUS, PRIORITY, SEVERITY } from './types'
import { dayKey } from './time'
import { sortBugs, sortPlans } from './derive'
import { saveExport } from '@/lib/export'
import { toast } from './store'

const block = (label: string, text: string) =>
  text.trim() ? `- **${label}**：${text.trim().split('\n').join('  \n  ')}\n` : ''

export function toMarkdown(s: State): string {
  const lines: string[] = [`# PinPlan 开发日志`, ``, `> 导出于 ${new Date().toLocaleString('zh-CN')}`, ``]
  lines.push(`## 计划（${s.plans.length}）`, ``)
  for (const p of sortPlans(s.plans)) {
    lines.push(`### ${p.pinned ? '[置顶] ' : ''}[${PLAN_STATUS[p.status].label}] ${p.title}`)
    lines.push(`优先级 ${PRIORITY[p.priority]} · 创建 ${dayKey(p.created_at)}${p.tags.length ? ` · #${p.tags.join(' #')}` : ''}`, ``)
    const body = block('预期', p.expect) + block('实际', p.result) + block('复盘', p.lesson) + block('备注', p.detail)
    if (body) lines.push(body)
  }
  lines.push(`## BUG（${s.bugs.length}）`, ``)
  lines.push(`| 状态 | 严重度 | 标题 | 修复 |`, `| --- | --- | --- | --- |`)
  for (const b of sortBugs(s.bugs)) {
    const fix = [b.fix_commit && `\`${b.fix_commit}\``, b.fix_note.replace(/\n/g, '<br>')].filter(Boolean).join(' ')
    lines.push(`| ${BUG_STATUS[b.status].label} | ${SEVERITY[b.severity].label} | ${b.title} | ${fix} |`)
  }
  return lines.join('\n') + '\n'
}

export function toJSON(s: State): string {
  const { plans, bugs, events, projects, seq } = s
  return JSON.stringify({ app: 'pinplan', version: 1, plans, bugs, events, projects, seq }, null, 2)
}

export function download(name: string, content: string, _type: string) {
  void saveExport(name, content).then((path) => toast(`已导出：${path}`)).catch((error) => toast(`导出失败：${String(error)}`))
}
