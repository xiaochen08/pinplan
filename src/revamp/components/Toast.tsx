import { Undo2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { dismissToast, useStore } from '@/revamp/lib/store'

export function Toaster() {
  const t = useStore((s) => s.toast)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center">
      <AnimatePresence mode="popLayout">
        {t && (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            className="pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-[12.5px] text-on-ink shadow-pop"
          >
            {t.tone && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.tone }} />}
            <span className="truncate">{t.message}</span>
            {t.undo ? (
              <button type="button" onClick={t.undo} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-on-ink/12 px-3 font-medium hover:bg-on-ink/20">
                <Undo2 size={12} strokeWidth={2} />
                撤销
              </button>
            ) : (
              <button type="button" onClick={dismissToast} className="h-7 cursor-pointer rounded-full px-2 text-on-ink/60 hover:text-on-ink">
                好
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
