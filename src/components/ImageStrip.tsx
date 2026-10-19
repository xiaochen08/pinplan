import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import * as repo from '@/lib/repo'
import type { Attachment } from '@/lib/repo'
import { clipboardImages, encodeImage, humanBytes } from '@/lib/images'
import { useStore } from '@/store/useStore'
import { Icon } from '@/components/ui/Icon'

/**
 * 详情面板里的图片区。
 *
 * 添加方式：在窗口任意位置 Ctrl+V 粘贴，或点「选择」按钮。
 * 图片会先等比压缩再入库（见 lib/images.ts），避免库里塞满几 MB 的截图。
 * 点缩略图看大图，悬停右上角可删除。
 */
export function ImageStrip({ entity, id, onNotify }: { entity: 'plan' | 'bug'; id: number; onNotify?: (text: string, tone?: 'ok' | 'warn' | 'bad' | 'info') => void }) {
  const legacyNotify = useStore((s) => s.notify)
  const notify = onNotify ?? legacyNotify
  const refreshCounts = useStore((s) => s.refreshAttachmentCounts)
  const [items, setItems] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<Attachment | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setItems(await repo.listAttachments(entity, id))
  }, [entity, id])

  useEffect(() => {
    void load()
  }, [load])

  const ingest = useCallback(
    async (blobs: Blob[]) => {
      if (blobs.length === 0) return
      setBusy(true)
      try {
        for (const b of blobs) {
          const enc = await encodeImage(b)
          await repo.addAttachment({
            entity,
            entity_id: id,
            name: b instanceof File ? b.name : '',
            mime: enc.mime,
            width: enc.width,
            height: enc.height,
            bytes: enc.bytes,
            data: enc.dataUrl,
          })
        }
        await load()
        await refreshCounts()
        notify(blobs.length > 1 ? `已添加 ${blobs.length} 张图片` : '图片已添加', 'ok')
      } catch (err) {
        notify(`图片添加失败：${err instanceof Error ? err.message : String(err)}`, 'bad')
      } finally {
        setBusy(false)
      }
    },
    [entity, id, load, notify, refreshCounts],
  )

  // 详情面板打开期间，粘贴图片就加到当前这条记录上。
  // 粘贴文字时 clipboardImages 返回空数组，不会误触。
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = clipboardImages(e)
      if (files.length === 0) return
      e.preventDefault()
      void ingest(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [ingest])

  // 看大图时按 Esc 关闭
  useEffect(() => {
    if (!view) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view])

  const remove = async (a: Attachment) => {
    if (view?.id === a.id) setView(null)
    await repo.removeAttachment(a.id)
    await load()
    await refreshCounts()
    notify('图片已删除', 'warn')
  }

  const total = items.reduce((n, a) => n + a.bytes, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-ink-500">图片</span>
        <span className="tnum text-[10.5px] text-ink-500">
          {items.length > 0 ? `${items.length} 张 · ${humanBytes(total)}` : '还没有'}
        </span>
        <span className="flex-1" />
        {busy ? (
          <span className="text-[10.5px] text-ink-400">处理中…</span>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="no-drag flex h-6 items-center gap-1 rounded-[7px] border border-tint-8 px-2 text-[10.5px] text-ink-300 transition-colors hover:bg-tint-6 hover:text-ink-100"
          >
            <Icon name="plus" size={11} />
            选择
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            void ingest(files)
          }}
        />
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="no-drag flex w-full flex-col items-center gap-1 rounded-[10px] border border-dashed border-tint-12 py-4 text-ink-500 transition-colors hover:border-tint-20 hover:text-ink-300"
        >
          <Icon name="image" size={16} />
          <span className="text-[11px]">Ctrl+V 粘贴截图</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((a) => (
            <div key={a.id} className="group relative">
              <button
                type="button"
                onClick={() => setView(a)}
                title={`${a.name || '截图'} · ${a.width}×${a.height} · ${humanBytes(a.bytes)}`}
                className="no-drag block aspect-[4/3] w-full overflow-hidden rounded-[8px] border border-tint-8 bg-tint-4 transition-colors hover:border-tint-20"
              >
                <img
                  src={a.data}
                  alt={a.name || '截图'}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </button>
              <button
                type="button"
                aria-label="删除这张图"
                onClick={() => void remove(a)}
                className="no-drag absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-ink-950/85 text-ink-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-[var(--color-failed)]"
              >
                <Icon name="x" size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {view && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setView(null)}
              className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/72 p-6 backdrop-blur-[2px]"
            >
              <motion.img
                src={view.data}
                alt={view.name || '截图'}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.8 }}
                draggable={false}
                className="max-h-full max-w-full rounded-[6px] object-contain shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)]"
              />
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] text-ink-200">
                {view.width}×{view.height} · {humanBytes(view.bytes)} · 点击任意处关闭
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
