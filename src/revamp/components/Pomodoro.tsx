import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { pomodoroPause, pomodoroReset, pomodoroSkip, pomodoroStart, useStore } from '@/revamp/lib/store'
import { mmss } from '@/revamp/lib/time'
import { IconBtn, cx } from './ui'

/** Fixed-width digits so a proportional serif doesn't jitter every second. */
function Digits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cx('inline-flex', className)} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} className={cx('inline-block text-center', ch === ':' ? 'w-[0.3em] -translate-y-[0.06em]' : 'w-[0.56em]')}>
          {ch}
        </span>
      ))}
    </span>
  )
}

export function Pomodoro({ compact }: { compact?: boolean }) {
  const p = useStore((s) => s.pomodoro)
  const work = useStore((s) => s.settings.pomodoroWork)
  const brk = useStore((s) => s.settings.pomodoroBreak)
  const isWork = p.phase === 'work'
  const tone = isWork ? 'var(--seal)' : 'var(--s-done)'
  const progress = p.total ? 1 - p.remaining / p.total : 0
  const lit = p.completed === 0 ? 0 : ((p.completed - 1) % 4) + 1
  const idle = !p.running && p.remaining === p.total

  const toggle = (
    <button
      type="button"
      onClick={() => (p.running ? pomodoroPause() : pomodoroStart())}
      className={cx(
        'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full pr-3 pl-2.5 text-[12px] font-medium transition-colors',
        p.running ? 'bg-sheet-3 text-ink hover:bg-rule' : 'bg-ink text-on-ink hover:bg-ink-2',
      )}
    >
      {p.running ? <Pause size={12} strokeWidth={2.2} /> : <Play size={12} strokeWidth={2.2} />}
      {p.running ? '暂停' : idle ? '开始' : '继续'}
    </button>
  )

  if (compact) {
    return (
      <div className="relative flex items-center gap-2.5 border-b border-rule px-4 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone, animation: p.running ? 'breathe 2.6s ease-in-out infinite' : undefined }} />
        <span className="text-[11.5px] text-ink-3">{isWork ? '专注' : '休息'}</span>
        <Digits text={mmss(p.remaining)} className="font-serif text-[22px] leading-none text-ink" />
        <div className="ml-auto flex items-center gap-0.5">
          <IconBtn icon={p.running ? Pause : Play} label={p.running ? '暂停' : '开始'} onClick={() => (p.running ? pomodoroPause() : pomodoroStart())} />
          <IconBtn icon={SkipForward} label="跳过当前阶段" size={14} onClick={pomodoroSkip} />
        </div>
        <span className="absolute bottom-[-1px] left-0 h-[1.5px] transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%`, background: tone }} />
      </div>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-[10px] bg-sheet shadow-[0_0_0_1px_var(--rule)]">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone, animation: p.running ? 'breathe 2.6s ease-in-out infinite' : undefined }} />
          {isWork ? '专注' : '休息'} · 第 {p.completed + (isWork ? 1 : 0)} 轮
        </span>
        <span className="flex gap-1" title={`本组已完成 ${lit}/4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-[5px] w-[5px] rounded-full" style={{ background: i < lit ? tone : 'var(--rule-strong)' }} />
          ))}
        </span>
      </div>
      <Digits text={mmss(p.remaining)} className={cx('px-3 pt-1 font-serif text-[46px] leading-[1.05]', p.running ? 'text-ink' : 'text-ink-2')} />
      <div className="flex items-center gap-1 px-3 pt-1 pb-3">
        {toggle}
        <IconBtn icon={SkipForward} label="跳过当前阶段" size={14} onClick={pomodoroSkip} />
        <IconBtn icon={RotateCcw} label="重置" size={13} onClick={pomodoroReset} />
        <span className="ml-auto font-mono text-[10.5px] text-ink-4">
          {work}′/{brk}′
        </span>
      </div>
      <span className="absolute bottom-0 left-0 h-[2px] transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%`, background: tone }} />
    </section>
  )
}
