import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import { PLAN_STATUS, type Plan, type PlanStatus } from '@/lib/types'
import { duration, relTime } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { IconButton, StatusChip } from '@/components/ui/primitives'
import { listItem, spring, tap } from '@/components/ui/motion'
import { copyText, planText } from '@/lib/clipboard'

const ALL_STATUS: PlanStatus[] = ['draft', 'doing', 'done', 'failed', 'parked', 'dropped']

const PRIORITY_LABEL: Record<number, string> = {
  0: '低',
  1: '中',
  2: '高',
  3: '紧急',
}

interface Props {
  plan: Plan
  now: number
  onOpen: () => void
  dense?: boolean
}

export function PlanRow({ plan, now, onOpen, dense }: Props) {
  const movePlan = useStore((s) => s.movePlan)
  const patchPlan = useStore((s) => s.patchPlan)
  const removePlan = useStore((s) => s.removePlan)
  const notify = useStore((s) => s.notify)
  const imgCount = useStore((s) => s.attachmentCounts[`plan:${plan.id}`] ?? 0)
  const [menu, setMenu] = useState(false)
  /** 菜单朝上还是朝下弹：下方空间不够就翻上去，避免被裁掉 */
  const [flip, setFlip] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const meta = PLAN_STATUS[plan.status]
  const isDoing = plan.status === 'doing'
  const isClosed = plan.status === 'done' || plan.status === 'failed' || plan.status === 'dropped'

  // 状态切换时整行泛一下光，让"改状态"这件事有过程而不是硬切
  const prevStatus = useRef(plan.status)
  const [flashKey, setFlashKey] = useState(0)
  useEffect(() => {
    if (prevStatus.current === plan.status) return
    prevStatus.current = plan.status
    setFlashKey((k) => k + 1)
  }, [plan.status])

  const elapsed =
    isDoing && plan.started_at ? duration((now - new Date(plan.started_at).getTime()) / 1000) : null
  const took =
    !isDoing && plan.started_at && plan.finished_at
      ? duration(
          (new Date(plan.finished_at).getTime() - new Date(plan.started_at).getTime()) / 1000,
        )
      : null

  // 点外面关掉状态菜单
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  const primary: { label: string; icon: 'play' | 'check' | 'reset'; to: PlanStatus } | null =
    plan.status === 'draft' || plan.status === 'parked'
      ? { label: '开始', icon: 'play', to: 'doing' }
      : plan.status === 'doing'
        ? { label: '成功', icon: 'check', to: 'done' }
        : { label: '重开', icon: 'reset', to: 'doing' }

  return (
    <motion.div
      ref={wrapRef}
      layout
      variants={listItem}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={spring}
      className={clsx(
        'card group relative overflow-visible px-2.5',
        dense ? 'py-2' : 'py-2.5',
        isClosed && 'opacity-62',
        plan.status === 'parked' && 'opacity-70',
      )}
    >
      {/* 状态切换时的整行泛光（只在真正切换时出现，首次渲染不闪） */}
      {flashKey > 0 && (
        <motion.span
          key={flashKey}
          aria-hidden
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-[12px]"
          style={{ boxShadow: `inset 0 0 0 1.5px ${meta.color}` }}
        />
      )}

      {/* 左侧状态竖条：静态色条，进行中不再做呼吸动画（避免拖动时每帧重合成） */}
      <span
        className="absolute top-2 bottom-2 left-0 w-[2.5px] rounded-full transition-[background-color,opacity] duration-200"
        style={{ background: meta.color, opacity: isDoing ? 1 : 0.5 }}
      />

      <div className="flex items-start gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="block w-full text-left" title={plan.title}>
            <div
              className={clsx(
                'truncate text-[13px] leading-snug font-medium text-ink-100',
                plan.status === 'done' && 'line-through decoration-tint-25',
                plan.status === 'dropped' && 'line-through decoration-tint-15',
              )}
            >
              {plan.title}
            </div>
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (menu) {
                  setMenu(false)
                  return
                }
                const r = wrapRef.current?.getBoundingClientRect()
                setFlip(!!r && window.innerHeight - r.bottom < 260)
                setMenu(true)
              }}
              className="no-drag rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
              title="切换状态"
            >
              <StatusChip label={meta.label} color={meta.color} glyph={meta.glyph} />
            </button>

            {elapsed && (
              <span className="tnum inline-flex items-center gap-0.5">
                <Icon name="clock" size={10.5} />
                {elapsed}
              </span>
            )}
            {took && <span className="tnum">耗时 {took}</span>}
            {plan.priority >= 2 && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{ color: plan.priority === 3 ? 'var(--color-failed)' : 'var(--color-parked)' }}
              >
                <Icon name="zap" size={10.5} />
                {PRIORITY_LABEL[plan.priority]}
              </span>
            )}
            {plan.pinned === 1 && (
              <Icon name="pin" size={10.5} className="text-[var(--color-accent-soft)]" />
            )}
            {imgCount > 0 && (
              <span className="inline-flex items-center gap-0.5" title={`${imgCount} 张图片`}>
                <Icon name="image" size={10.5} />
                {imgCount}
              </span>
            )}
            {plan.status === 'failed' && plan.lesson && (
              <span className="truncate text-[var(--color-failed)]/80">
                为什么：{plan.lesson}
              </span>
            )}
            {!elapsed && !took && plan.status !== 'failed' && (
              <span>{relTime(plan.updated_at)}</span>
            )}
          </div>
        </div>

        {/* 悬浮操作区 */}
        <div className="no-drag flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          {primary && (
            <motion.button
              type="button"
              whileTap={tap}
              transition={spring}
              onClick={() => void movePlan(plan.id, primary.to)}
              title={primary.label}
              className={clsx(
                'inline-flex h-6 items-center gap-1 rounded-[8px] px-2 text-[11.5px] font-medium',
                primary.to === 'done'
                  ? 'bg-[var(--color-done)]/18 text-[var(--color-done)] hover:bg-[var(--color-done)]/26'
                  : 'bg-tint-8 text-ink-200 hover:bg-tint-14',
              )}
            >
              <Icon name={primary.icon} size={11.5} />
              {primary.label}
            </motion.button>
          )}
          {plan.status === 'doing' && (
            <IconButton
              icon="x"
              label="标记失败"
              size={13}
              tone="danger"
              onClick={() => void movePlan(plan.id, 'failed')}
              className="h-6 w-6"
            />
          )}
          <IconButton
            icon="copy"
            label="复制内容"
            size={13}
            onClick={() =>
              void copyText(planText(plan)).then((ok) =>
                notify(ok ? '已复制到剪贴板' : '复制失败', ok ? 'ok' : 'bad'),
              )
            }
            className="h-6 w-6"
          />
          <IconButton
            icon="pin"
            label={plan.pinned ? '取消钉住' : '钉住'}
            size={13}
            active={plan.pinned === 1}
            onClick={() => void patchPlan(plan.id, { pinned: plan.pinned ? 0 : 1 })}
            className="h-6 w-6"
          />
        </div>
      </div>

      {/* 状态切换菜单 */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={spring}
            className={clsx(
              'glass glass-blur absolute left-2 z-40 w-[168px] p-1',
              flip ? 'bottom-full mb-1' : 'top-full mt-1',
            )}
            style={{ borderRadius: 12 }}
          >
            {ALL_STATUS.filter((s) => s !== plan.status).map((s) => {
              const st = PLAN_STATUS[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setMenu(false)
                    void movePlan(plan.id, s)
                  }}
                  className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12px] text-ink-200 transition-colors duration-120 hover:bg-tint-8"
                >
                  <span
                    className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
                    style={{
                      color: st.color,
                      background: `color-mix(in oklab, ${st.color} 18%, transparent)`,
                    }}
                  >
                    {st.glyph}
                  </span>
                  {st.label}
                  <span className="ml-auto text-[10.5px] text-ink-500">{st.hint}</span>
                </button>
              )
            })}
            <div className="my-1 h-px bg-tint-8" />
            <button
              type="button"
              onClick={() => {
                setMenu(false)
                void removePlan(plan.id)
              }}
              className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12px] text-[var(--color-failed)] transition-colors duration-120 hover:bg-[var(--color-failed)]/12"
            >
              <Icon name="trash" size={12} />
              删除这条
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
