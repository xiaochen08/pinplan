import { format, isToday, isYesterday, differenceInMinutes } from 'date-fns'

/** 相对时间：刚刚 / 12 分钟前 / 3 小时前 / 昨天 14:20 / 8月14日 */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const mins = differenceInMinutes(new Date(), d)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  if (isToday(d)) return `${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `昨天 ${format(d, 'HH:mm')}`
  return format(d, 'M月d日')
}

/** 绝对时间：8月14日 15:02 */
export function absTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'M月d日 HH:mm')
}

export function clock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'HH:mm')
}

/** 秒 → mm:ss */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 秒 → 「1h 20m」/「25m」 */
export function duration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/** 两条时间之间的人话时长 */
export function spanText(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null
  const a = new Date(fromIso).getTime()
  const b = new Date(toIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  return duration((b - a) / 1000)
}

export function todayLabel(): string {
  return format(new Date(), 'M月d日')
}

export function weekdayLabel(): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return names[new Date().getDay()]
}

/** 本地日期键 YYYY-MM-DD */
export function dayKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

/** "23:00" → 当天分钟数 */
export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** 当前时间是否落在免打扰区间（支持跨零点，如 23:00–09:00）。 */
export function inQuietHours(start: string, end: string, at: Date = new Date()): boolean {
  const cur = at.getHours() * 60 + at.getMinutes()
  const s = clockToMinutes(start)
  const e = clockToMinutes(end)
  if (s === e) return false
  return s < e ? cur >= s && cur < e : cur >= s || cur < e
}
