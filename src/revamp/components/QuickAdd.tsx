import { CornerDownLeft, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createBug, createPlan, useStore } from '@/revamp/lib/store'
import type { Severity } from '@/revamp/lib/types'
import { SEVERITY } from '@/revamp/lib/types'
import { cx, Kbd } from './ui'

const SEV_KEYS: Severity[] = ['blocker', 'high', 'normal', 'low']

export function QuickAdd({ kind, compact }: { kind: 'plan' | 'bug'; compact?: boolean }) {
  const [text, setText] = useState('')
  const [severity, setSeverity] = useState<Severity>('normal')
  const [focused, setFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const focusNonce = useStore((s) => s.ui.quickFocus)

  useEffect(() => {
    if (focusNonce) ref.current?.focus()
  }, [focusNonce])

  const submit = async () => {
    if (saving || !text.trim()) return
    setSaving(true)
    try {
      const id = await (kind === 'plan' ? createPlan(text) : createBug(text, severity))
      if (id) setText('')
    } finally { setSaving(false) }
  }

  return (
    <div
      className={cx(
        'flex items-center gap-2.5 transition-colors',
        compact ? 'h-11 border-t border-rule px-4' : 'h-12 rounded-[9px] bg-sheet px-3.5 shadow-[0_0_0_1px_var(--rule)]',
        focused && !compact && 'shadow-[0_0_0_1px_var(--ink-3)]',
      )}
    >
      <Plus size={15} strokeWidth={1.8} className={focused ? 'text-seal' : 'text-ink-4'} />
      <input
        ref={ref}
        value={text}
        disabled={saving}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
          if (e.key === 'Escape') {
            setText('')
            ref.current?.blur()
          }
        }}
        placeholder={kind === 'plan' ? '记一条计划…' : '记一个 BUG…'}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
      />
      {kind === 'bug' && (
        <div className="flex gap-0.5">
          {SEV_KEYS.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSeverity(s)}
              title={SEVERITY[s].label}
              className={cx(
                'h-5.5 cursor-pointer rounded-[4px] px-1.5 font-mono text-[10px] font-medium transition-colors',
                severity === s ? 'bg-ink text-on-ink' : 'text-ink-4 hover:text-ink-2',
              )}
            >
              {SEVERITY[s].short}
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <span className={cx('hidden items-center gap-2 text-[11px] text-ink-4 transition-opacity sm:flex', focused || text ? 'opacity-100' : 'opacity-0')}>
          <span className="font-mono">! 高优先</span>
          <span className="font-mono">#标签</span>
        </span>
      )}
      {text ? (
        <button type="button" onClick={submit} className="grid h-6 w-6 cursor-pointer place-items-center rounded-[5px] bg-ink text-on-ink">
          <CornerDownLeft size={12} strokeWidth={2} />
        </button>
      ) : (
        !compact && <Kbd>{kind === 'plan' ? 'Alt N' : 'Alt B'}</Kbd>
      )}
    </div>
  )
}
