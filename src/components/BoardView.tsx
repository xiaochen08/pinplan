import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import { PLAN_COLUMNS, PLAN_STATUS, type Plan, type PlanStatus } from '@/lib/types'
import { duration } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { spring } from '@/components/ui/motion'

/**
 * 看板视图。
 *
 * 用 HTML5 原生拖放而不是 dnd-kit —— 单窗口内 4 列的场景下，
 * 原生 DnD 已经足够顺滑，且少一层依赖和坐标计算。
 */
export function BoardView({
  plans,
  now,
  onOpen,
}: {
  plans: Plan[]
  now: number
  onOpen: (id: number) => void
}) {
  const movePlan = useStore((s) => s.movePlan)
  const [dragId, setDragId] = useState<number | null>(null)
  const [overCol, setOverCol] = useState<PlanStatus | null>(null)

  const grouped = useMemo(() => {
    const map: Record<string, Plan[]> = {}
    for (const col of PLAN_COLUMNS) map[col] = []
    for (const p of plans) {
      if (map[p.status]) map[p.status].push(p)
    }
    return map
  }, [plans])

  return (
    <div className="scroll flex h-full gap-2.5 px-3 pb-3">
      {PLAN_COLUMNS.map((col) => {
        const meta = PLAN_STATUS[col]
        const items = grouped[col] ?? []
        const isOver = overCol === col
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(col)
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              setOverCol(null)
              if (dragId !== null) void movePlan(dragId, col)
              setDragId(null)
            }}
            className={clsx(
              'flex w-[168px] shrink-0 flex-col rounded-[13px] border p-1.5 transition-colors duration-150',
              isOver ? 'border-tint-18 bg-tint-6' : 'border-tint-6 bg-tint-2',
            )}
          >
            <div className="mb-1.5 flex items-center gap-1.5 px-1.5 pt-0.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: meta.color }}
              />
              <span className="text-[11.5px] font-medium text-ink-200">{meta.label}</span>
              <span className="tnum ml-auto text-[11px] text-ink-500">{items.length}</span>
            </div>

            <div className="scroll flex min-h-[40px] flex-1 flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {items.map((p) => {
                  const elapsed =
                    p.status === 'doing' && p.started_at
                      ? duration((now - new Date(p.started_at).getTime()) / 1000)
                      : null
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      layoutId={`board-${p.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={spring}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverCol(null)
                      }}
                      onClick={() => onOpen(p.id)}
                      className={clsx(
                        'card cursor-grab px-2 py-1.5 active:cursor-grabbing',
                        dragId === p.id && 'opacity-40',
                      )}
                    >
                      <div className="truncate text-[12px] leading-snug font-medium text-ink-100">
                        {p.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-500">
                        {p.pinned === 1 && (
                          <Icon name="pin" size={9.5} className="text-[var(--color-accent-soft)]" />
                        )}
                        {p.priority >= 2 && (
                          <span
                            style={{
                              color:
                                p.priority === 3
                                  ? 'var(--color-failed)'
                                  : 'var(--color-parked)',
                            }}
                          >
                            {p.priority === 3 ? '紧急' : '高'}
                          </span>
                        )}
                        {elapsed && <span className="tnum">{elapsed}</span>}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {items.length === 0 && (
                <div className="grid flex-1 place-items-center rounded-[9px] border border-dashed border-tint-7 py-4 text-[10.5px] text-ink-600">
                  拖到这里
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
