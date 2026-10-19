import { BookOpen, Bug as BugIcon, EyeOff, ListChecks, Minimize2, Moon, Radar, Search, Settings2, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { setUI, triggerCheckin, updateSettings, useStore, type View } from '@/revamp/lib/store'
import { useStats } from '@/revamp/lib/derive'
import type { BugStatus, PlanStatus } from '@/revamp/lib/types'
import { BUG_STATUS, PLAN_STATUS } from '@/revamp/lib/types'
import { todayParts } from '@/revamp/lib/time'
import { Pomodoro } from './Pomodoro'
import { Glyph, IconBtn, Kbd, Label, Ring, cx } from './ui'

export function BrandMark({ size = 10 }: { size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full bg-seal shadow-[inset_0_-1.5px_0_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.25)]" />
      <span className="absolute top-[22%] left-[26%] h-[28%] w-[28%] rounded-full bg-white/50" />
    </span>
  )
}

export function TitleBar() {
  const search = useStore((s) => s.ui.search)
  const theme = useStore((s) => s.settings.theme)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-rule px-4">
      <div data-tauri-drag-region className="drag flex w-[216px] shrink-0 items-center gap-2.5">
        <BrandMark />
        <span className="font-serif text-[20px] leading-none tracking-tight">PinPlan</span>
        <span className="font-cn text-[11px] text-ink-4">钉子计划</span>
      </div>
      <label className="group flex h-8 max-w-[420px] flex-1 items-center gap-2 rounded-[7px] bg-sheet-2 px-2.5 shadow-[inset_0_0_0_1px_var(--rule)] focus-within:shadow-[inset_0_0_0_1px_var(--ink-3)]">
        <Search size={13} className="text-ink-4" />
        <input
          ref={ref}
          value={search}
          onChange={(e) => setUI({ search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setUI({ search: '' })
              ref.current?.blur()
            }
          }}
          placeholder="搜索计划、BUG、复盘…"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
        />
        <Kbd>/</Kbd>
      </label>
      <div className="ml-auto flex items-center gap-0.5">
        <IconBtn icon={theme === 'paper' ? Moon : Sun} label={theme === 'paper' ? '夜读模式' : '纸面模式'} onClick={() => updateSettings({ theme: theme === 'paper' ? 'night' : 'paper' })} />
        <IconBtn icon={Settings2} label="设置" onClick={() => setUI({ settingsOpen: true })} />
        <span className="mx-1.5 h-4 w-px bg-rule" />
        <IconBtn icon={Minimize2} label="收成钉子小窗" onClick={() => setUI({ mode: 'mini' })} />
        <IconBtn icon={EyeOff} label="藏到边缘小钉 (Alt Space)" onClick={() => setUI({ hidden: true })} />
      </div>
    </div>
  )
}

function NavItem({ icon: Icon, label, count, active, alert, onClick }: { icon: LucideIcon; label: string; count?: number; active: boolean; alert?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 text-[13px] transition-colors',
        active ? 'bg-ink text-on-ink' : 'text-ink-2 hover:bg-sheet-3',
      )}
    >
      <Icon size={15} strokeWidth={1.7} />
      <span className="font-medium">{label}</span>
      {count !== undefined && (
        <span className={cx('ml-auto font-mono text-[11px] tnum', active ? 'text-on-ink/70' : alert ? 'text-bug' : 'text-ink-4')}>{count}</span>
      )}
    </button>
  )
}

function FilterItem({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-7 w-full cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-[12.5px] transition-colors',
        active ? 'bg-sheet-3 text-ink' : 'text-ink-3 hover:bg-sheet-2 hover:text-ink-2',
      )}
    >
      {children}
      <span className="ml-auto font-mono text-[10.5px] text-ink-4 tnum">{count}</span>
    </button>
  )
}

const PLAN_FILTERS: PlanStatus[] = ['doing', 'draft', 'parked', 'done', 'failed', 'dropped']
const BUG_FILTERS: BugStatus[] = ['open', 'fixing', 'fixed', 'verified', 'wontfix']

export function Rail() {
  const view = useStore((s) => s.ui.view)
  const planFilter = useStore((s) => s.ui.planFilter)
  const bugFilter = useStore((s) => s.ui.bugFilter)
  const project = useStore((s) => s.ui.project)
  const projects = useStore((s) => s.projects)
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  const events = useStore((s) => s.events)
  const stats = useStats()
  const today = todayParts()

  const planCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of plans) if (project === null || p.project_id === project) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [plans, project])
  const bugCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const b of bugs) if (project === null || b.project_id === project) c[b.status] = (c[b.status] ?? 0) + 1
    return c
  }, [bugs, project])

  const go = (v: View) => setUI({ view: v })

  return (
    <aside className="scroll flex w-[248px] shrink-0 flex-col gap-4 [&>*]:shrink-0 border-r border-rule bg-sheet-2/60 px-3.5 py-5">
      {/* Today */}
      <section className="flex items-center gap-3 px-1">
        <span className="font-serif text-[58px] leading-[0.8] tracking-tight">{today.day}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-cn text-[13px] font-semibold">
            {today.month} · {today.weekday}
          </div>
          <div className="mt-1 font-mono text-[10.5px] whitespace-nowrap text-ink-4">
            今日 +{stats.todayDone + stats.todayFixed}
          </div>
        </div>
        <Ring value={stats.rate} size={46} stroke={3} color="var(--s-done)">
          <span className="font-serif text-[15px] leading-none tnum" title="成功率 = 成功 /（成功 + 失败 + 放弃）">
            {Math.round(stats.rate * 100)}
            <span className="text-[10px] text-ink-3">%</span>
          </span>
        </Ring>
      </section>

      <div className="grid grid-cols-3 overflow-hidden rounded-[9px] shadow-[0_0_0_1px_var(--rule)]">
        {[
          { n: stats.doing, l: '进行中', c: 'var(--s-doing)' },
          { n: stats.done, l: '成功', c: 'var(--s-done)' },
          { n: stats.failed + stats.dropped, l: '败 / 弃', c: 'var(--s-failed)' },
        ].map((x, i) => (
          <div key={x.l} className={cx('bg-sheet px-2.5 py-2', i > 0 && 'border-l border-rule')}>
            <div className="font-serif text-[24px] leading-none tnum" style={{ color: x.c }}>
              {x.n}
            </div>
            <div className="mt-1 text-[10.5px] text-ink-3">{x.l}</div>
          </div>
        ))}
      </div>

      <Pomodoro />

      <nav className="space-y-0.5">
        <NavItem icon={ListChecks} label="计划" count={stats.total} active={view === 'plans'} onClick={() => go('plans')} />
        <NavItem icon={BugIcon} label="BUG" count={stats.openBugs} alert={stats.openBugs > 0} active={view === 'bugs'} onClick={() => go('bugs')} />
        <NavItem icon={BookOpen} label="日志" count={events.length} active={view === 'journal'} onClick={() => go('journal')} />
      </nav>

      {view !== 'journal' && (
        <section>
          <Label className="mb-1.5 px-2.5">状态</Label>
          {view === 'plans' ? (
            <>
              <FilterItem active={planFilter === 'all'} onClick={() => setUI({ planFilter: 'all' })} count={Object.values(planCounts).reduce((a, b) => a + b, 0)}>
                <span className="grid w-[14px] place-items-center text-ink-4">∗</span>全部
              </FilterItem>
              {PLAN_FILTERS.map((st) => (
                <FilterItem key={st} active={planFilter === st} onClick={() => setUI({ planFilter: st })} count={planCounts[st] ?? 0}>
                  <Glyph status={st} size={14} />
                  {PLAN_STATUS[st].label}
                </FilterItem>
              ))}
            </>
          ) : (
            <>
              <FilterItem active={bugFilter === 'all'} onClick={() => setUI({ bugFilter: 'all' })} count={Object.values(bugCounts).reduce((a, b) => a + b, 0)}>
                <span className="grid w-[14px] place-items-center text-ink-4">∗</span>全部
              </FilterItem>
              {BUG_FILTERS.map((st) => (
                <FilterItem key={st} active={bugFilter === st} onClick={() => setUI({ bugFilter: st })} count={bugCounts[st] ?? 0}>
                  <Glyph status={st} size={14} />
                  {BUG_STATUS[st].label}
                </FilterItem>
              ))}
            </>
          )}
        </section>
      )}

      <section>
        <Label className="mb-1.5 px-2.5">项目</Label>
        <FilterItem active={project === null} onClick={() => setUI({ project: null })} count={plans.length + bugs.length}>
          <span className="grid w-[14px] place-items-center">
            <span className="h-2 w-2 rounded-[2px] border border-ink-4" />
          </span>
          全部项目
        </FilterItem>
        {projects.map((p) => (
          <FilterItem
            key={p.id}
            active={project === p.id}
            onClick={() => setUI({ project: p.id })}
            count={plans.filter((x) => x.project_id === p.id).length + bugs.filter((x) => x.project_id === p.id).length}
          >
            <span className="grid w-[14px] place-items-center">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} />
            </span>
            <span className="truncate font-mono text-[11.5px]">{p.name}</span>
          </FilterItem>
        ))}
      </section>

      <div className="mt-auto">
        <button
          type="button"
          onClick={() => triggerCheckin(true)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left shadow-[inset_0_0_0_1px_var(--rule-strong)] transition-colors hover:bg-sheet-3"
        >
          <Radar size={15} strokeWidth={1.7} className="text-seal" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium">现在巡检一次</span>
            <span className="block text-[10.5px] text-ink-4">追问最久没动的进行中计划</span>
          </span>
        </button>
      </div>
    </aside>
  )
}
