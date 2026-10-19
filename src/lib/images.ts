/**
 * 图片处理：从剪贴板取图 → 等比压缩 → 编码成 data URL。
 *
 * 直接存原图会把库撑爆（一张 4K 截图动辄好几 MB），
 * 所以先按长边 1600 缩放，再编码成 WebP 0.82，通常能压到几百 KB。
 */

/** 长边上限（像素）。超过就等比缩小。 */
const MAX_SIDE = 1600
const QUALITY = 0.82

export interface EncodedImage {
  dataUrl: string
  mime: string
  width: number
  height: number
  bytes: number
}

/** 从粘贴事件里挑出图片文件（截图、复制的图片都走这里）。 */
export function clipboardImages(e: ClipboardEvent | React.ClipboardEvent): File[] {
  const dt = 'clipboardData' in e ? e.clipboardData : null
  if (!dt) return []
  const out: File[] = []
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) out.push(file)
  }
  return out
}

/** 缩放 + 编码。返回可直接塞进 <img src> 的 data URL。 */
export async function encodeImage(
  file: Blob,
  maxSide = MAX_SIDE,
  quality = QUALITY,
): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布上下文')
    ctx.drawImage(bitmap, 0, 0, w, h)

    // Chromium 支持 WebP 编码；万一不支持会静默回退成 PNG，所以下面读回真实 mime
    const dataUrl = canvas.toDataURL('image/webp', quality)
    const comma = dataUrl.indexOf(',')
    const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
    const bytes = Math.round(((dataUrl.length - comma - 1) * 3) / 4)

    return { dataUrl, mime, width: w, height: h, bytes }
  } finally {
    bitmap.close()
  }
}

/** 人类可读的文件大小。 */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
