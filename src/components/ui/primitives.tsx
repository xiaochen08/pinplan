import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { Icon, type IconName } from './Icon'
import {
  popup as popupVariants,
  release,
  spring,
  tap,
} from './motion'

/** 按压反馈的第三层：内阴影（"按下去"的物理感） */
const PRESS_INSET = 'active:shadow-[inset_0_1px_3px_rgba(0,0,0,.38)]'

/* ==================================================================
   按钮
   ================================================================== */

type Tone = 'ghost' | 'solid' | 'accent' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone
  size?: 'sm' | 'md'
  icon?: IconName
}

const TONE: Record<Tone, string> = {
  ghost: 'bg-tint-5 hover:bg-tint-10 active:bg-tint-16 text-ink-100 border border-tint-8',
  solid: 'bg-tint-10 hover:bg-tint-16 active:bg-tint-22 text-ink-100 border border-tint-10',
  accent:
    'text-white border border-transparent bg-[var(--color-accent)] hover:brightness-110 active:brightness-95 shadow-[0_6px_18px_-8px_var(--color-accent)]',
  danger:
    'text-[var(--color-failed)] bg-[var(--color-failed)]/12 hover:bg-[var(--color-failed)]/20 active:bg-[var(--color-failed)]/28 border border-[var(--color-failed)]/25',
}

export function Button({
  tone = 'ghost',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={tap}
      whileHover={{ y: -1, transition: { duration: 0.12 } }}
      transition={release}
      className={clsx(
        'no-drag inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium',
        'transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none',
        PRESS_INSET,
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[12.5px]',
        TONE[tone],
        className,
      )}
      {...(rest as Record<string, unknown>)}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 14} />}
      {children}
    </motion.button>
  )
}

/* ==================================================================
   图标按钮
   ================================================================== */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  size?: number
  active?: boolean
  tone?: 'default' | 'danger'
}

export function IconButton({
  icon,
  label,
  size = 15,
  active,
  tone = 'default',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={tap}
      transition={release}
      className={clsx(
        'no-drag grid h-7 w-7 place-items-center rounded-[9px] transition-colors duration-150',
        PRESS_INSET,
        active
          ? 'bg-tint-12 text-ink-100'
          : 'text-ink-300 hover:bg-tint-8 active:bg-tint-14 hover:text-ink-100',
        tone === 'danger' &&
          'hover:bg-[var(--color-failed)]/15 active:bg-[var(--color-failed)]/25 hover:text-[var(--color-failed)]',
        className,
      )}
      {...(rest as Record<string, unknown>)}
    >
      <Icon name={icon} size={size} />
    </motion.button>
  )
}

/* ==================================================================
   分段控件（滑动指示器）
   ================================================================== */

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string; badge?: number }[]
  onChange: (v: T) => void
  layoutId: string
  className?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  layoutId,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={clsx(
        'seg no-drag relative flex items-center gap-0.5 rounded-[11px] bg-tint-4 p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              'relative z-10 flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[9px]',
              'px-2.5 text-[12.5px] font-medium transition-colors duration-200',
              active ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className="seg-pill absolute inset-0 -z-10 rounded-[9px] bg-tint-10 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
              />
            )}
            {opt.label}
            {opt.badge !== undefined && opt.badge > 0 && (
              <span
                className={clsx(
                  'tnum rounded-full px-1.5 text-[10.5px] leading-4',
                  active ? 'bg-tint-15 text-ink-100' : 'bg-tint-8 text-ink-300',
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ==================================================================
   进度环
   ================================================================== */

interface RingProps {
  /** 0 ~ 1 */
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
  gradientId?: string
}

export function ProgressRing({
  value,
  size = 36,
  stroke = 3.5,
  color = 'var(--color-accent)',
  track = 'rgba(255,255,255,.09)',
  children,
  gradientId,
}: RingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  const gid = gradientId ?? `ring-${size}-${stroke}`

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="var(--color-accent-soft)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-0 grid place-items-center">{children}</div>
      )}
    </div>
  )
}

/* ==================================================================
   状态徽标
   ================================================================== */

export function StatusChip({
  label,
  color,
  glyph,
  className,
}: {
  label: string
  color: string
  glyph?: string
  className?: string
}) {
  return (
    <span
      className={clsx(
        'chip inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10.5px] font-medium',
        // 状态切换时颜色平滑过渡，而不是硬切
        'transition-colors duration-200 ease-out',
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 26%, transparent)`,
      }}
    >
      {glyph && (
        <motion.span
          key={glyph}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={release}
          className="text-[9px] leading-none"
        >
          {glyph}
        </motion.span>
      )}
      {label}
    </span>
  )
}

/* ==================================================================
   滚动数字
   ================================================================== */

/**
 * 逐字滚动的数字。倒计时这类每秒跳一次的地方，
 * 硬替换会显得生硬 —— 这里让变化的字符上下滚动。
 * 未变化的字符（比如冒号）不会触发任何动画。
 */
export function RollingDigits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={clsx('inline-flex', className)}>
      {text.split('').map((ch, i) => (
        <span key={i} className="relative inline-block">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              initial={{ y: 7, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -7, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.2, 0.8, 0.3, 1] }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

/* ==================================================================
   文本输入
   ================================================================== */

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: IconName
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { icon, className, ...rest },
  ref,
) {
  return (
    <div
      className={clsx(
        'no-drag focus-ring flex h-8 items-center gap-2 rounded-[10px] border border-tint-8 bg-tint-4 px-2.5',
        className,
      )}
    >
      {icon && <Icon name={icon} size={13} className="shrink-0 text-ink-400" />}
      <input ref={ref} className="h-full w-full text-[12.5px]" {...rest} />
    </div>
  )
})

/* ==================================================================
   轻提示
   ================================================================== */

const NOTICE_TONE = {
  ok: 'text-[var(--color-done)] border-[var(--color-done)]/25',
  warn: 'text-[var(--color-parked)] border-[var(--color-parked)]/25',
  bad: 'text-[var(--color-failed)] border-[var(--color-failed)]/25',
  info: 'text-ink-200 border-tint-12',
}

export function Notice({
  notice,
}: {
  notice: { id: number; text: string; tone: keyof typeof NOTICE_TONE } | null
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[58px] z-50 flex justify-center px-3">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            variants={popupVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className={clsx(
              'glass glass-blur relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium',
              NOTICE_TONE[notice.tone],
            )}
            style={{ borderRadius: 999 }}
          >
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ==================================================================
   空状态
   ================================================================== */

export function EmptyState({
  icon = 'pin',
  title,
  hint,
}: {
  icon?: IconName
  title: string
  hint?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex flex-col items-center justify-center gap-2 py-10 text-center"
    >
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-tint-8 bg-tint-4 text-ink-400">
        <Icon name={icon} size={19} />
      </div>
      <div className="text-[12.5px] text-ink-300">{title}</div>
      {hint && <div className="max-w-[80%] text-[11.5px] leading-relaxed text-ink-500">{hint}</div>}
    </motion.div>
  )
}

/* ==================================================================
   开关
   ================================================================== */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'no-drag relative h-[18px] w-[32px] shrink-0 rounded-full border transition-colors duration-200',
        checked
          ? 'border-transparent bg-[var(--color-accent)]'
          : 'border-tint-10 bg-tint-8',
      )}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-[1px] h-[14px] w-[14px] rounded-full bg-white shadow-sm"
        style={{ left: checked ? 16 : 1 }}
      />
    </button>
  )
}
