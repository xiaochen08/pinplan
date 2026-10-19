import { motion } from 'motion/react'
import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import { BUG_STATUS, SEVERITY, type Bug } from '@/lib/types'
import { relTime } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { IconButton, StatusChip } from '@/components/ui/primitives'
import { listItem, spring, tap } from '@/components/ui/motion'
import { bugText, copyText } from '@/lib/clipboard'

interface Props {
  bug: Bug
  onOpen: () => void
}

export function BugRow({ bug, onOpen }: Props) {
  const fixBug = useStore((s) => s.fixBug)
  const patchBug = useStore((s) => s.patchBug)
  const removeBug = useStore((s) => s.removeBug)
  const notify = useStore((s) => s.notify)
  const imgCount = useStore((s) => s.attachmentCounts[`bug:${bug.id}`] ?? 0)

  const meta = BUG_STATUS[bug.status]
  const sev = SEVERITY[bug.severity]
  const isFixed = bug.status === 'fixed' || bug.status === 'verified'

  return (
    <motion.div
      layout
      variants={listItem}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={spring}
      className={clsx('card group relative px-2.5 py-2.5', isFixed && 'opacity-62')}
    >
      <span
        className="absolute top-2 bottom-2 left-0 w-[2.5px] rounded-full transition-[background-color,opacity] duration-200"
        style={{ background: meta.color, opacity: isFixed ? 0.45 : 0.9 }}
      />

      <div className="flex items-start gap-2 pl-2">
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[7px]"
          style={{
            color: sev.color,
            background: `color-mix(in oklab, ${sev.color} 15%, transparent)`,
          }}
          title={`严重度：${sev.label}`}
        >          <Icon name="bug" size={12} />
        </span>

        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" title={bug.title}>
          <div className="relative inline-block max-w-full">
            <span
              className={clsx(
                'block truncate text-[13px] leading-snug font-medium',
                isFixed ? 'text-ink-300' : 'text-ink-100',
              )}
            >
              {bug.title}
            </span>
            {isFixed && (
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                style={{ originX: 0 }}
                className="absolute top-1/2 left-0 h-px w-full bg-[var(--color-done)]/70"
              />
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
            <StatusChip label={meta.label} color={meta.color} glyph={meta.glyph} />
            <span style={{ color: sev.color }}>{sev.label}</span>
            {bug.repro && <span className="truncate">可复现</span>}
            {imgCount > 0 && (
              <span className="inline-flex items-center gap-0.5" title={`${imgCount} 张图片`}>
                <Icon name="image" size={10.5} />
                {imgCount}
              </span>
            )}
            <span>{isFixed && bug.fixed_at ? `修于 ${relTime(bug.fixed_at)}` : relTime(bug.created_at)}</span>
          </div>
        </button>

        <div className="no-drag flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          {!isFixed ? (
            <motion.button
              type="button"
              whileTap={tap}
              transition={spring}
              onClick={() => void fixBug(bug.id)}
              className="inline-flex h-6 items-center gap-1 rounded-[8px] bg-[var(--color-done)]/18 px-2 text-[11.5px] font-medium text-[var(--color-done)] hover:bg-[var(--color-done)]/26"
              title="标记已修复"
            >
              <Icon name="check" size={11.5} />
              修复
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={tap}
              transition={spring}
              onClick={() => void patchBug(bug.id, { status: 'open', fixed_at: null })}
              className="inline-flex h-6 items-center gap-1 rounded-[8px] bg-tint-8 px-2 text-[11.5px] text-ink-300 hover:bg-tint-14"
              title="重新打开"
            >
              <Icon name="reset" size={11.5} />
              重开
            </motion.button>
          )}
          {bug.status === 'fixed' && (
            <IconButton
              icon="checkCheck"
              label="已验证"
              size={13}
              className="h-6 w-6"
              onClick={() => void patchBug(bug.id, { status: 'verified' })}
            />
          )}
          <IconButton
            icon="copy"
            label="复制内容"
            size={13}
            className="h-6 w-6"
            onClick={() =>
              void copyText(bugText(bug)).then((ok) =>
                notify(ok ? '已复制到剪贴板' : '复制失败', ok ? 'ok' : 'bad'),
              )
            }
          />
          <IconButton
            icon="trash"
            label="删除"
            size={13}
            tone="danger"
            className="h-6 w-6"
            onClick={() => void removeBug(bug.id)}
          />
        </div>
      </div>
    </motion.div>
  )
}
