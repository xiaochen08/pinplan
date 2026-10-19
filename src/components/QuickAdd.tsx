import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import { Icon } from '@/components/ui/Icon'
import { spring } from '@/components/ui/motion'

interface Props {
  /** 外部触发聚焦（托盘 / 全局快捷键） */
  pulse: number
}

/** 底部快速输入：Enter 提交，Esc 清空。 */
export function QuickAdd({ pulse }: Props) {
  const tab = useStore((s) => s.tab)
  const addPlan = useStore((s) => s.addPlan)
  const addBug = useStore((s) => s.addBug)

  const [value, setValue] = useState('')
  const [focus, setFocus] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pulse > 0) ref.current?.focus()
  }, [pulse])

  const submit = async () => {
    const text = value.trim()
    if (!text) return
    setValue('')
    if (tab === 'plan') await addPlan(text)
    else await addBug(text)
    ref.current?.focus()
  }

  const isPlan = tab === 'plan'

  return (
    <div className="px-2.5 pt-1 pb-2.5">
      <div className="no-drag focus-ring flex h-9 items-center gap-2 rounded-[11px] border border-tint-7 bg-tint-3 px-2.5">
        <motion.span
          animate={{ rotate: focus ? 90 : 0, color: isPlan ? 'var(--color-accent-soft)' : 'var(--color-bug)' }}
          transition={spring}
          className="grid place-items-center"
        >
          <Icon name={isPlan ? 'plus' : 'bug'} size={14} />
        </motion.span>

        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
            if (e.key === 'Escape') {
              setValue('')
              e.currentTarget.blur()
            }
          }}
          placeholder={isPlan ? '记一条计划…' : '记一个 BUG…'}
          className="h-full w-full text-[12.5px]"
        />

        <motion.span
          animate={{ opacity: value.trim() ? 1 : 0, scale: value.trim() ? 1 : 0.9 }}
          transition={spring}
          className={clsx(
            'tnum shrink-0 rounded-[6px] border border-tint-10 bg-tint-6 px-1 text-[10px] text-ink-400',
          )}
        >
          ↵
        </motion.span>
      </div>
    </div>
  )
}
