const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTH_CN = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export const nowIso = () => new Date().toISOString()

export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function duration(ms: number): string {
  if (ms < MIN) return '<1m'
  if (ms < HOUR) return `${Math.floor(ms / MIN)}m`
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR)
    const m = Math.floor((ms % HOUR) / MIN)
    return m ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(ms / DAY)
  const h = Math.floor((ms % DAY) / HOUR)
  return h ? `${d}d ${h}h` : `${d}d`
}

export function ago(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  if (diff < MIN) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MIN)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayLabel(key: string, now = new Date()): { main: string; sub: string } {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((today.getTime() - date.getTime()) / DAY)
  const sub = `${m}月${d}日 ${WEEK[date.getDay()]}`
  if (diff === 0) return { main: '今天', sub }
  if (diff === 1) return { main: '昨天', sub }
  if (diff === 2) return { main: '前天', sub }
  return { main: `${m}月${d}日`, sub: WEEK[date.getDay()] }
}

export function todayParts(now = new Date()) {
  return {
    day: String(now.getDate()),
    month: MONTH_CN[now.getMonth()],
    monthNum: now.getMonth() + 1,
    weekday: WEEK[now.getDay()],
    year: now.getFullYear(),
  }
}

export const isToday = (iso: string | null) => !!iso && dayKey(iso) === dayKey(new Date().toISOString())
