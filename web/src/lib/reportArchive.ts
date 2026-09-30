/**
 * ★ 세션72f — 제보 사진 «관리자 검토용 축소본» (제이 결정 2026-09-30 · 서버 보관 90일)
 *   · OCR 은 지금처럼 원본으로 한다(판독 정확도를 건드리지 않는다 — Eval-First).
 *   · 이 축소본은 관리자 화면에서 «사진 보며 정정»할 근거로만 쓴다. 긴 변 1600px · JPEG.
 *   · 실패해도 제보는 그대로 간다 — null 을 돌려주고 끝(축소본 없이 전송).
 *   · createImageBitmap 이 없는 환경(구형 브라우저·테스트 jsdom)은 즉시 null.
 */
export const ARCHIVE_MAX_BYTES = 1536 * 1024   // 서버 030 cp_size_chk 와 같은 값
const STEPS: Array<[number, number]> = [[1600, 0.8], [1280, 0.7]]

async function encode(file: Blob, maxDim: number, quality: number): Promise<Blob | null> {
  const bmp = await createImageBitmap(file)   // EXIF 방향은 브라우저가 적용한다(image-orientation 기본값)
  try {
    let w = bmp.width; let h = bmp.height
    if (!w || !h) return null
    if (w > maxDim || h > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s) }
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bmp, 0, 0, w, h)
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
  } finally {
    bmp.close?.()
  }
}

/** 원본 → 축소본(≤1.5MB) 또는 null. 절대 throw 하지 않는다. */
export async function makeArchiveCopy(file: Blob | null | undefined): Promise<Blob | null> {
  if (!file || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  try {
    for (const [dim, q] of STEPS) {
      const b = await encode(file, dim, q)
      if (b && b.size > 0 && b.size <= ARCHIVE_MAX_BYTES) return b
    }
  } catch { /* 축소 실패 — 축소본 없이 제보 */ }
  return null
}
