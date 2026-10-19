import { motion } from 'motion/react'
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { BugStatus, PlanStatus } from '@/revamp/lib/types'
import { BUG_STATUS, PLAN_STATUS } from '@/revamp/lib/types'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ------------------------------------------------------------------
   Status glyph — drawn, not typed, so it stays crisp at 12–16px.
   ------------------------------------------------------------------ */

type GlyphKind = PlanStatus | BugStatus

export function Glyph({ status, size = 14, className }: { status: GlyphKind; size?: number; className?: string }) {
  const color = (PLAN_STATUS as Record<string, { color: string }>)[status]?.color ??
    (BUG_STATUS as Record<string, { color: string }>)[status]?.color
  const sw = 1.4
  const ring = <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth={sw} />
  let inner: ReactNode = null
  switch (status) {
    case 'draft':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={{ color }} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth={sw} strokeDasharray="2.2 2.2" />
        </svg>
      )
    case 'doing':
    case 'fixing':
      inner = <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
      break
    case 'done':
    case 'fixed':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={{ color }} aria-hidden>
          <circle cx="8" cy="8" r="6.7" fill="currentColor" />
          <path d="M5 8.2 7.1 10.2 11 6" fill="none" stroke="var(--sheet)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'verified':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={{ color }} aria-hidden>
          <circle cx="8" cy="8" r="6.7" fill="currentColor" />
          <path d="M3.8 8.3 5.6 10 8.8 6.3M7.6 9.4l.6.6 3.6-4" fill="none" stroke="var(--sheet)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'failed':
      inner = <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      break
    case 'parked':
      inner = <path d="M6.6 5.6v4.8M9.4 5.6v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      break
    case 'dropped':
    case 'wontfix':
      inner = <path d="M3.9 12.1 12.1 3.9" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      break
    case 'open':
      inner = (
        <>
          <path d="M8 4.8v3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11" r=".95" fill="currentColor" />
        </>
      )
      break
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={{ color }} aria-hidden>
      {ring}
      {inner}
    </svg>
  )
}

/* ------------------------------------------------------------------
   Ink stamp — outcomes get pressed into the page.
   ------------------------------------------------------------------ */

export function Stamp({
  label,
  sub,
  color,
  fresh,
  size = 'sm',
  tilt = -5,
}: {
  label: string
  sub?: string
  color: string
  fresh?: boolean
  size?: 'sm' | 'lg'
  tilt?: number
}) {
  const lg = size === 'lg'
  return (
    <motion.span
      initial={fresh ? { scale: 1.9, opacity: 0, rotate: tilt - 10 } : false}
      animate={{ scale: 1, opacity: 1, rotate: tilt }}
      transition={{ type: 'spring', stiffness: 520, damping: 22, mass: 0.7 }}
      className={cx(
        'pointer-events-none inline-flex shrink-0 items-center gap-1.5 rounded-[3px] font-cn font-bold select-none',
        lg ? 'px-2.5 py-1 text-[15px] tracking-[0.18em]' : 'px-1.5 py-[1px] text-[11px] tracking-[0.14em]',
      )}
      style={{
        color,
        boxShadow: `inset 0 0 0 1.5px ${color}, inset 0 0 0 3px var(--sheet), inset 0 0 0 3.6px ${color}`,
        opacity: 0.9,
      }}
    >
      {label}
      {sub && <span className={cx('font-mono font-medium tracking-normal', lg ? 'text-[11px]' : 'text-[9.5px]')}>{sub}</span>}
    </motion.span>
  )
}

/* ------------------------------------------------------------------ */

export function Ring({
  value,
  size = 44,
  stroke = 3,
  color = 'var(--s-done)',
  track = 'var(--rule)',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */

type BtnVariant = 'ink' | 'line' | 'ghost' | 'tint'

export function Btn({
  variant = 'line',
  icon: Icon,
  tone,
  children,
  className,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  icon?: LucideIcon
  tone?: string
  size?: 'sm' | 'md'
}) {
  const style =
    variant === 'tint' && tone
      ? { color: tone, backgroundColor: `color-mix(in oklab, ${tone} 11%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tone} 28%, transparent)` }
      : tone && variant !== 'ink'
        ? { color: tone }
        : undefined
  return (
    <button
      type="button"
      {...rest}
      style={{ ...style, ...rest.style }}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7.5 px-3 text-[12.5px]',
        variant === 'ink' && 'bg-ink text-on-ink hover:bg-ink-2',
        variant === 'line' && 'text-ink-2 shadow-[inset_0_0_0_1px_var(--rule-strong)] hover:bg-sheet-3 hover:text-ink',
        variant === 'ghost' && 'text-ink-3 hover:bg-sheet-3 hover:text-ink',
        variant === 'tint' && 'hover:brightness-95',
        className,
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 12 : 14} strokeWidth={1.8} />}
      {children}
    </button>
  )
}

export function IconBtn({
  icon: Icon,
  label,
  active,
  size = 15,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[6px] transition-colors duration-150',
        active ? 'bg-sheet-3 text-ink' : 'text-ink-3 hover:bg-sheet-3 hover:text-ink',
        className,
      )}
    >
      <Icon size={size} strokeWidth={1.7} />
    </button>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 font-mono text-[10px] font-medium text-ink-3 shadow-[inset_0_0_0_1px_var(--rule-strong),0_1px_0_var(--rule-strong)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; color?: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const id = useId()
  return (
    <div className="inline-flex rounded-[7px] bg-sheet-3 p-[2px]">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'relative cursor-pointer rounded-[5px] font-medium transition-colors',
              size === 'sm' ? 'h-5.5 px-2 text-[11px]' : 'h-6.5 px-2.5 text-[12px]',
              on ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
            style={on && o.color ? { color: o.color } : undefined}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[5px] bg-sheet shadow-[0_0_0_1px_var(--rule),0_1px_2px_rgba(0,0,0,0.06)]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('font-mono text-[10px] font-medium tracking-[0.14em] text-ink-4 uppercase', className)}>
      {children}
    </div>
  )
}

export const no = (id: number) => `No.${String(id).padStart(3, '0')}`
