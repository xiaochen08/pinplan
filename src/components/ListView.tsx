import { AnimatePresence } from 'motion/react'
import { useStore } from '@/store/useStore'
import type { Bug, Plan } from '@/lib/types'
import { PlanRow } from './PlanRow'
import { BugRow } from './BugRow'
import { EmptyState } from './ui/primitives'

interface Props {
  plans: Plan[]
  bugs: Bug[]
  now: number
  dense?: boolean
  /** 是否有筛选条件生效（用于区分「本来就没有」和「筛掉了」） */
  filtered?: boolean
  onOpenPlan: (id: number) => void
  onOpenBug: (id: number) => void
}

export function ListView({ plans, bugs, now, dense, filtered, onOpenPlan, onOpenBug }: Props) {
  const tab = useStore((s) => s.tab)
  const query = useStore((s) => s.query)
  const isPlan = tab === 'plan'
  const items = isPlan ? plans : bugs

  if (items.length === 0) {
    const searching = query.trim().length > 0
    return (
      <EmptyState
        icon={isPlan ? 'pin' : 'bug'}
        title={
          searching
            ? '没有匹配的条目'
            : filtered
              ? '这个筛选下没有条目'
              : isPlan
                ? '还没有计划'
                : '还没有 BUG'
        }
        hint={
          searching
            ? '换个关键词试试'
            : filtered
              ? '点上面的「清除」看全部'
              : isPlan
                ? '在下面输入框敲一条，Enter 就记下了'
                : '发现问题随手记下来，修好后点一下就行'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <AnimatePresence initial={false} mode="popLayout">
        {isPlan
          ? plans.map((p) => (
              <PlanRow key={p.id} plan={p} now={now} dense={dense} onOpen={() => onOpenPlan(p.id)} />
            ))
          : bugs.map((b) => (
              <BugRow key={b.id} bug={b} onOpen={() => onOpenBug(b.id)} />
            ))}
      </AnimatePresence>
    </div>
  )
}
