import { useMemo } from 'react'
import { useStore } from './store'
import type { Bug, Plan } from './types'
import { PLAN_ORDER, SEVERITY } from './types'
import { isToday } from './time'

const BUG_ORDER = ['open', 'fixing', 'fixed', 'verified', 'wontfix']

export function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      PLAN_ORDER.indexOf(a.status) - PLAN_ORDER.indexOf(b.status) ||
      b.priority - a.priority ||
      b.updated_at.localeCompare(a.updated_at),
  )
}

export function sortBugs(bugs: Bug[]): Bug[] {
  return [...bugs].sort(
    (a, b) =>
      BUG_ORDER.indexOf(a.status) - BUG_ORDER.indexOf(b.status) ||
      SEVERITY[a.severity].rank - SEVERITY[b.severity].rank ||
      b.updated_at.localeCompare(a.updated_at),
  )
}

const match = (q: string, ...fields: string[]) => {
  if (!q) return true
  const needle = q.toLowerCase()
  return fields.some((f) => f.toLowerCase().includes(needle))
}

export function useVisiblePlans(): Plan[] {
  const plans = useStore((s) => s.plans)
  const filter = useStore((s) => s.ui.planFilter)
  const project = useStore((s) => s.ui.project)
  const q = useStore((s) => s.ui.search)
  return useMemo(
    () =>
      sortPlans(
        plans.filter(
          (p) =>
            (project === null || p.project_id === project) &&
            (filter === 'all' ||
              (filter === 'active' ? p.status === 'doing' || p.status === 'draft' : p.status === filter)) &&
            match(q, p.title, p.detail, p.expect, p.result, p.lesson, p.tags.join(' ')),
        ),
      ),
    [plans, filter, project, q],
  )
}

export function useVisibleBugs(): Bug[] {
  const bugs = useStore((s) => s.bugs)
  const filter = useStore((s) => s.ui.bugFilter)
  const project = useStore((s) => s.ui.project)
  const q = useStore((s) => s.ui.search)
  return useMemo(
    () =>
      sortBugs(
        bugs.filter(
          (b) =>
            (project === null || b.project_id === project) &&
            (filter === 'all' ||
              (filter === 'active' ? b.status === 'open' || b.status === 'fixing' : b.status === filter)) &&
            match(q, b.title, b.repro, b.fix_note, b.fix_commit),
        ),
      ),
    [bugs, filter, project, q],
  )
}

export function useStats() {
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  return useMemo(() => {
    const by = (st: Plan['status']) => plans.filter((p) => p.status === st).length
    const done = by('done')
    const failed = by('failed')
    const dropped = by('dropped')
    const closed = done + failed + dropped
    return {
      doing: by('doing'),
      draft: by('draft'),
      parked: by('parked'),
      done,
      failed,
      dropped,
      total: plans.length,
      rate: closed ? done / closed : 0,
      closed,
      openBugs: bugs.filter((b) => b.status === 'open' || b.status === 'fixing').length,
      bugsTotal: bugs.length,
      todayDone: plans.filter((p) => p.status === 'done' && isToday(p.finished_at)).length,
      todayFixed: bugs.filter((b) => isToday(b.fixed_at)).length,
      unreviewed: plans.filter((p) => p.status === 'failed' && !p.lesson.trim()).length,
    }
  }, [plans, bugs])
}
