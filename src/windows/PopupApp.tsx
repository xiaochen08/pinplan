import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { invoke } from '@tauri-apps/api/core'
import { PhysicalPosition, getCurrentWindow } from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import {
  broadcastChanged,
  emitAnswered,
  onCheckin,
  type CheckinPayload,
} from '@/lib/bus'
import * as repo from '@/lib/repo'
import { Icon } from '@/components/ui/Icon'
import { popup as popupVariants, spring, tap } from '@/components/ui/motion'

type AnswerKey = 'still' | 'stuck' | 'park' | 'done' | 'drop'

const AUTO_HIDE_MS = 22_000

/** 右下角滑入的巡检追问卡片。回答直接回写数据库，不需要打开主窗。 */
export function PopupApp() {
  const [req, setReq] = useState<CheckinPayload | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(async () => {
    setReq(null)
    setNote('')
    await getCurrentWindow().hide()
  }, [])

  const armAutoHide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void hide(), AUTO_HIDE_MS)
  }, [hide])

  useEffect(() => {
    // 弹窗是独立窗口，自己读一次设置以同步强调色
    void repo.loadSettings().then((s) => {
      document.documentElement.dataset.accent = s.accent
      document.documentElement.dataset.glass = s.glass
      document.documentElement.dataset.theme = s.theme
    })
  }, [])

  useEffect(() => {
    const sub: Promise<UnlistenFn> = onCheckin(async (payload) => {
      setReq(payload)
      setNote('')

      const win = getCurrentWindow()
      const [size, scale, area] = await Promise.all([
        win.outerSize(),
        win.scaleFactor(),
        invoke<{ x: number; y: number; w: number; h: number }>('monitor_work_area'),
      ])
      // 贴到工作区右下角（排除任务栏），留 18px 呼吸空间
      const margin = 18 * scale
      const x = area.x + area.w - size.width - margin
      const y = area.y + area.h - size.height - margin
      await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)))
      await win.show()
      armAutoHide()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void hide()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      void sub.then((f) => f())
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [armAutoHide, hide])

  const answer = async (key: AnswerKey) => {
    if (!req || busy) return
    setBusy(true)
    const noteText = note.trim()
    try {
      await repo.logCheckin(
        'plan',
        req.id,
        req.question,
        noteText ? `${key}｜${noteText}` : key,
      )

      if (key === 'done') await repo.setPlanStatus(req.id, 'done')
      else if (key === 'drop') await repo.setPlanStatus(req.id, 'dropped')
      else if (key === 'park') await repo.setPlanStatus(req.id, 'parked')
      else if (key === 'stuck' && noteText) {
        await repo.updatePlan(req.id, { result: noteText })
      }

      await emitAnswered()
      await broadcastChanged()
    } finally {
      setBusy(false)
      await hide()
    }
  }

  const parkMode = (req?.streak ?? 0) >= 2

  const options: { key: AnswerKey; label: string; tone: string; icon: 'play' | 'zap' | 'park' | 'check' | 'x' }[] =
    [
      { key: 'still', label: '还在做', tone: 'var(--color-doing)', icon: 'play' },
      parkMode
        ? { key: 'park', label: '先搁置', tone: 'var(--color-parked)', icon: 'park' }
        : { key: 'stuck', label: '卡住了', tone: 'var(--color-parked)', icon: 'zap' },
      { key: 'done', label: '已完成', tone: 'var(--color-done)', icon: 'check' },
      { key: 'drop', label: '放弃', tone: 'var(--color-ink-400)', icon: 'x' },
    ]

  return (
    <div className="relative h-full w-full">
      <div
        className="glass glass-window absolute inset-0 flex flex-col overflow-hidden"
        style={{ borderRadius: 14 }}
      >
        <AnimatePresence>
          {req && (
            <motion.div
              key={req.id}
              variants={popupVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex h-full flex-col p-3"
            >
              {/* 标题 */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[8px] bg-[var(--color-accent)]/18 text-[var(--color-accent-soft)]">
                  <Icon name="target" size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-ink-100">{req.question}</div>
                  <div className="mt-1 truncate text-[12px] text-ink-300" title={req.title}>
                    {req.title}
                  </div>
                  <div className="tnum mt-0.5 text-[10.5px] text-ink-500">{req.meta}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void hide()}
                  className="-mt-0.5 -mr-0.5 grid h-6 w-6 place-items-center rounded-[8px] text-ink-500 transition-colors hover:bg-tint-8 hover:text-ink-200"
                  aria-label="稍后再说"
                  title="稍后再说"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>

              {/* 快捷回答 */}
              <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                {options.map((o) => (
                  <motion.button
                    key={o.key}
                    type="button"
                    whileTap={tap}
                    whileHover={{ y: -1 }}
                    transition={spring}
                    disabled={busy}
                    onClick={() => void answer(o.key)}
                    className="flex h-[46px] flex-col items-center justify-center gap-0.5 rounded-[11px] border transition-colors duration-150 disabled:opacity-50"
                    style={{
                      color: o.tone,
                      borderColor: `color-mix(in oklab, ${o.tone} 26%, transparent)`,
                      background: `color-mix(in oklab, ${o.tone} 12%, transparent)`,
                    }}
                  >
                    <Icon name={o.icon} size={13} />
                    <span className="text-[11px] font-medium">{o.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* 备注 */}
              <div className="mt-auto flex items-center gap-2 pt-2.5">
                <input
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    armAutoHide()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && note.trim()) void answer('still')
                  }}
                  placeholder="补一句…（可选）"
                  className="h-7 flex-1 rounded-[9px] border border-tint-7 bg-tint-4 px-2.5 text-[11.5px]"
                />
                <span className="tnum shrink-0 text-[10.5px] text-ink-600">↵ 记下</span>
              </div>

              {/* 自动收起进度 */}
              <motion.span
                className="absolute bottom-0 left-0 h-[2px] bg-[var(--color-accent)]/70"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: AUTO_HIDE_MS / 1000, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
