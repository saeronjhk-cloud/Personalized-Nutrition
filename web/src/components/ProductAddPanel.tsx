import { useEffect, useRef, useState } from 'react'
import { searchProducts, type MsSearchItem } from '../lib/meokseon'
import {
  getPortion, productFoodFromPortion, REASON_TEXT, nutrientText,
  type PortionKind, type PortionResponse,
} from '../lib/productLog'
import type { MealFood } from '../lib/nutrilens'

/**
 * 가공식품 찾기 + «먹은 양» 고르기 (가공식품 기록 v1)
 * - 찾기: 📷 바코드(브라우저 BarcodeDetector) 또는 이름 검색(먹선 /search)
 * - 먹은 양: ¼·½·1·2개 · 1회 제공량 · 직접 g/ml → 먹선 /portion 이 계산한 값만 보여주고 담는다(산식 없음)
 */
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
export const PACK_CHIPS = [0.25, 0.5, 1, 2]
const PACK_TEXT: Record<number, string> = { 0.25: '¼개', 0.5: '½개', 1: '1개', 2: '2개' }

function scanSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
    && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
}

export default function ProductAddPanel({ onAdd }: { onAdd: (food: MealFood) => void }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<MsSearchItem[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<PortionResponse | null>(null)
  const [sel, setSel] = useState<{ kind: PortionKind; qty: number } | null>(null)
  const [gramText, setGramText] = useState('')
  const [scanning, setScanning] = useState(false)
  const seq = useRef(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // 이름 검색(300ms 디바운스 · 늦은 응답 무시)
  useEffect(() => {
    const query = q.trim()
    if (!query || picked) { setItems([]); return }
    const my = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await searchProducts(query, 10)
        if (my !== seq.current) return
        setItems(r.filter((x) => !!x.barcode))
        setMsg(r.length === 0 ? '찾는 제품이 없어요. 바코드로 찾아보시거나 「제품 스캔」에서 제보해 주세요.' : null)
      } catch {
        if (my === seq.current) setMsg('지금은 제품을 찾을 수 없어요. 잠시 후 다시 시도해 주세요.')
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, picked])

  function stopScan() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }
  useEffect(() => () => stopScan(), [])

  useEffect(() => {
    if (!scanning) return
    const video = videoRef.current, stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {})
    const detector = new (window as any).BarcodeDetector({ formats: BARCODE_FORMATS })
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      try {
        const codes = await detector.detect(video)
        const val = codes?.[0]?.rawValue ? String(codes[0].rawValue).replace(/\D/g, '') : ''
        if (val) {
          stopScan()
          if (/^\d{8,14}$/.test(val)) void pick(val)
          else setMsg('바코드를 읽지 못했어요. 다시 시도하거나 이름으로 찾아 주세요.')
          return
        }
      } catch { /* 프레임 감지 실패 무시 */ }
      if (!cancelled) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { cancelled = true; if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  async function startScan() {
    setMsg(null)
    if (!scanSupported()) { setMsg('이 화면에서는 카메라 바코드 읽기를 쓸 수 없어요. 제품 이름으로 찾아 주세요.'); return }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setScanning(true)
    } catch {
      stopScan(); setMsg('카메라를 열 수 없어요. 카메라 권한을 확인하거나 이름으로 찾아 주세요.')
    }
  }

  async function load(barcode: string, choice: { kind: PortionKind; qty: number } | null) {
    setBusy(true); setMsg(null)
    const r = await getPortion(barcode, choice?.kind, choice?.qty)
    setBusy(false)
    if (!r.ok) { setMsg(r.message); return null }
    return r.data
  }

  async function pick(barcode: string) {
    setItems([])
    const base = await load(barcode, null)
    if (!base) return
    const av = (k: PortionKind) => base.options.find((o) => o.kind === k)?.available
    const first: { kind: PortionKind; qty: number } | null = av('pack') ? { kind: 'pack', qty: 1 } : av('serving') ? { kind: 'serving', qty: 1 } : av('gram') ? { kind: 'gram', qty: 100 } : null
    if (!first) { setPicked(base); setSel(null); setMsg(REASON_TEXT[base.options[0]?.reason ?? 'no_nutrition'] + ' — 기록할 수 없어요.'); return }
    await choose(barcode, first)
  }

  async function choose(barcode: string, choice: { kind: PortionKind; qty: number }) {
    const d = await load(barcode, choice)
    if (!d) return
    setPicked(d); setSel(choice)
    if (d.portion && !d.portion.ok) setMsg(REASON_TEXT[d.portion.reason ?? ''] ?? '이 양으로는 계산할 수 없어요.')
  }

  function reset() { setPicked(null); setSel(null); setQ(''); setGramText(''); setMsg(null) }

  const food = picked ? productFoodFromPortion(picked.product, picked.portion) : null
  const opt = (k: PortionKind) => picked?.options.find((o) => o.kind === k)
  const unit = picked?.portion?.unit ?? (String(picked?.product.content_unit || '').toLowerCase().startsWith('m') ? 'ml' : 'g')
  const chip = (active: boolean, disabled = false) => ({
    width: 'auto', minHeight: 40, padding: 'var(--space-1) var(--space-3)', fontSize: 13,
    fontWeight: active ? 700 : 500, opacity: disabled ? 0.5 : 1,
  })

  return (
    <div data-testid="product-add-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {!picked && (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input type="search" value={q} maxLength={40} placeholder="제품 이름 (예: 새우깡)" onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1, minHeight: 44, padding: 'var(--space-2) var(--space-3)', fontSize: 15, border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text)', boxSizing: 'border-box' }} />
            <button type="button" className="btn btn-secondary" style={{ width: 'auto', minHeight: 44, padding: '0 var(--space-3)', fontSize: 13 }}
              onClick={() => (scanning ? stopScan() : void startScan())}>{scanning ? '닫기' : '📷 바코드'}</button>
          </div>
          {scanning && (
            <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--radius)', background: '#000' }} />
          )}
          {items.length > 0 && (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {items.map((it) => (
                <li key={it.barcode}>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void pick(it.barcode!)}
                    style={{ width: '100%', minHeight: 44, textAlign: 'left', justifyContent: 'flex-start', fontSize: 13, padding: 'var(--space-2) var(--space-3)' }}>
                    {it.product_name}{it.brand ? <span style={{ color: 'var(--text-muted)' }}> · {it.brand}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {picked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
            <strong style={{ fontSize: 15, color: 'var(--text)' }}>{picked.product.product_name}</strong>
            <button type="button" onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', minHeight: 40 }}>다른 제품</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>얼마나 드셨나요?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {opt('pack')?.available && PACK_CHIPS.map((qty) => (
              <button key={qty} type="button" className={`btn ${sel?.kind === 'pack' && sel.qty === qty ? 'btn-primary' : 'btn-secondary'}`} disabled={busy}
                style={chip(sel?.kind === 'pack' && sel.qty === qty)} onClick={() => void choose(picked.product.barcode, { kind: 'pack', qty })}>{PACK_TEXT[qty]}</button>
            ))}
            {opt('serving')?.available && (
              <button type="button" className={`btn ${sel?.kind === 'serving' ? 'btn-primary' : 'btn-secondary'}`} disabled={busy}
                style={chip(sel?.kind === 'serving')} onClick={() => void choose(picked.product.barcode, { kind: 'serving', qty: 1 })}>1회 제공량</button>
            )}
          </div>
          {opt('gram')?.available && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input type="number" inputMode="decimal" min={1} max={5000} value={gramText} placeholder={`직접 입력 (${unit})`} onChange={(e) => setGramText(e.target.value)}
                style={{ flex: 1, minHeight: 40, padding: 'var(--space-1) var(--space-3)', fontSize: 14, border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text)', boxSizing: 'border-box' }} />
              <button type="button" className={`btn ${sel?.kind === 'gram' ? 'btn-primary' : 'btn-secondary'}`} disabled={busy || !(Number(gramText) > 0)}
                style={chip(sel?.kind === 'gram')} onClick={() => void choose(picked.product.barcode, { kind: 'gram', qty: Number(gramText) })}>{unit} 적용</button>
            </div>
          )}
          {picked.options.filter((o) => !o.available).length > 0 && (
            <div data-testid="unavailable-reasons" style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {picked.options.filter((o) => !o.available).map((o) => `${o.kind === 'pack' ? '개수' : o.kind === 'serving' ? '1회 제공량' : '직접 입력'}: ${REASON_TEXT[o.reason ?? ''] ?? '사용할 수 없어요'}`).join(' · ')}
            </div>
          )}
          {food && (
            <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--border-light)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)', lineHeight: 1.6 }}>
              <strong>{food.amount}</strong> · 약 {Math.round(food.calories_kcal)} kcal{picked.portion?.approx ? ' (대략)' : ''}<br />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                탄수 {nutrientText(picked.portion?.nutrients?.carbs_g, 'g')} · 단백질 {nutrientText(picked.portion?.nutrients?.protein_g, 'g')} · 지방 {nutrientText(picked.portion?.nutrients?.fat_g, 'g')} · 당류 {nutrientText(picked.portion?.nutrients?.sugar_g, 'g')} · 나트륨 {nutrientText(picked.portion?.nutrients?.sodium_mg, 'mg')}
              </span>
              {(food.missing_nutrients?.length ?? 0) > 0 && (
                <><br /><span data-testid="missing-note" style={{ fontSize: 11, color: 'var(--text-muted)' }}>«정보 없음» 항목은 제품 DB에 값이 없어 합계에 더해지지 않아요.</span></>
              )}
            </div>
          )}
          <button type="button" className="btn btn-primary" disabled={busy || !food} style={{ width: '100%', minHeight: 44 }}
            onClick={() => { if (food) { onAdd(food); reset() } }}>{busy ? '계산 중…' : '담기'}</button>
        </div>
      )}

      {busy && !picked && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>불러오는 중…</div>}
      {msg && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{msg}</div>}
    </div>
  )
}
