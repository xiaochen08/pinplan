import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import { mmss } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { IconButton, RollingDigits } from '@/components/ui/primitives'

/** 番茄钟条：25 分钟专注 + 5 分钟休息，休息时触发巡检追问。
 *  刻意不用循环动画：进度每秒跳一次，其余元素静态，避免拖动窗口时渲染进程持续产帧。 */
export function PomodoroBar({ compact }: { compact?: boolean }) {
  const pomodoro = useStore((s) => s.pomodoro)
  const settings = useStore((s) => s.settings)
  const start = useStore((s) => s.pomodoroStart)
  const pause = useStore((s) => s.pomodoroPause)
  const reset = useStore((s) => s.pomodoroReset)
  const skip = useStore((s) => s.pomodoroSkip)

  const isWork = pomodoro.phase === 'work'
  const progress = pomodoro.total > 0 ? 1 - pomodoro.remaining / pomodoro.total : 0
  const accent = isWork ? 'var(--color-accent)' : 'var(--color-done)'
  // 当前这一组（4 个）里已经点亮几个
  const setFilled = pomodoro.completed === 0 ? 0 : ((pomodoro.completed - 1) % 4) + 1

  return (
    <div className="px-2.5 pb-2">
      <div className="relative overflow-hidden rounded-[12px] border border-tint-7 bg-tint-3">
        {/* 底部进度线：静态宽度，随秒跳 */}
        <div
          className="absolute bottom-0 left-0 h-[2px]"
          style={{ background: accent, opacity: 0.85, width: `${progress * 100}%` }}
        />

        <div className={clsx('flex items-center gap-2', compact ? 'px-2 py-1.5' : 'px-2.5 py-2')}>
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px]"
            style={{ color: accent, background: `color-mix(in oklab, ${accent} 15%, transparent)` }}
          >
            <Icon name={isWork ? 'target' : 'park'} size={13} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-medium text-ink-200">
                {isWork ? '专注' : '休息'}
              </span>
              <RollingDigits
                text={mmss(pomodoro.remaining)}
                className="tnum text-[15px] leading-none font-semibold tracking-tight text-ink-100"
              />
              {!pomodoro.running && <span className="text-[10.5px] text-ink-500">已暂停</span>}
            </div>
            {!compact && (
              <div className="mt-1 flex items-center gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-[3px] w-4 rounded-full"
                    style={{
                      backgroundColor: i < setFilled ? accent : 'rgba(255,255,255,.12)',
                    }}
                  />
                ))}
                <span className="tnum ml-1 text-[10.5px] text-ink-500">
                  {settings.pomodoro_work}′ / {settings.pomodoro_break}′
                </span>
              </div>
            )}
          </div>

          <div className="no-drag flex shrink-0 items-center gap-0.5">
            <IconButton
              icon={pomodoro.running ? 'pause' : 'play'}
              label={pomodoro.running ? '暂停' : '开始'}
              active={pomodoro.running}
              size={14}
              onClick={() => (pomodoro.running ? pause() : start())}
            />
            <IconButton icon="skip" label="跳过当前阶段" size={13} onClick={skip} />
            <IconButton icon="reset" label="重置" size={13} onClick={reset} />
          </div>
        </div>
      </div>
    </div>
  )
}
