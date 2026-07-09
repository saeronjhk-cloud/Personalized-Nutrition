import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLatestRecord } from '../lib/surveyHistory'
import { personalizeProduct } from '../domain/meokseon/personalize'
import { track } from '../lib/events'
import {
  buildScanRecord, saveScan, listScans, deleteScan, summarizeScans,
  type ScanRecord, type ScanSummary,
} from '../lib/scanHistory'
import {
  getProduct, getAdditiveSummary, searchProducts, meokseonConfigured, MeokseonNotFound,
  type MsProductResult, type MsAdditiveSummary, type MsSearchItem,
} from '../lib/meokseon'

// P1.5 먹선 후킹 — 무료 조회(카메라 바코드 스캔 주력 + 이름 검색 폴백).
// 카메라 스캔은 무의존성 BarcodeDetector(브라우저 네이티브). 미지원/거부 시 이름 검색으로 폴백.
// 개인정보 무관·무인증 공개 API 소비. 개인 맞춤은 동의/설문 후(맛보기는 중립+블러). 근거: 문서 61/62.

const NUTRIENTS: { key: keyof NonNullable<MsProductResult['nutrition']>; label: string; unit: string }[] = [
  { key: 'calories', label: '열량', unit: 'kcal' },
  { key: 'protein', label: '단백질', unit: 'g' },
  { key: 'total_fat', label: '지방', unit: 'g' },
  { key: 'saturated_fat', label: '포화지방', unit: 'g' },
  { key: 'trans_fat', label: '트랜스지방', unit: 'g' },
  { key: 'cholesterol', label: '콜레스테롤', unit: 'mg' },
  { key: 'sodium', label: '나트륨', unit: 'mg' },
  { key: 'total_carbs', label: '탄수화물', unit: 'g' },
  { key: 'total_sugars', label: '당류', unit: 'g' },
  { key: 'dietary_fiber', label: '식이섬유', unit: 'g' },
]

const COLOR_HEX: Record<string, string> = { green: '#4a9e3f', yellow: '#f59e0b', orange: '#ea580c', red: '#ef4444' }
// 먹선 위해성 평가(MFRAS) 4색 의미 — 서버 SCORE_LABEL과 동일.
const COLOR_LABEL: Record<string, string> = { green: '안전', yellow: '허용', orange: '주의', red: '위해' }
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

function scanSupported(): boolean {
  return typeof window !== 'undefined'
    && 'BarcodeDetector' in window
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function'
}

export default function Scan() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [result, setResult] = useState<MsProductResult | null>(null)
  const [additives, setAdditives] = useState<MsAdditiveSummary | null>(null)
  const [searchResults, setSearchResults] = useState<MsSearchItem[] | null>(null)
  const [reported, setReported] = useState(false)
  const [scanning, setScanning] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const [history, setHistory] = useState<ScanRecord[]>([])
  const [summary, setSummary] = useState<ScanSummary | null>(null)

  const latestRecord = getLatestRecord()
  // 개인화는 먹선 traffic_light 색을 소비(자체 임계 없음). 근거: 64 재평가 v1.
  const personal = (result && latestRecord)
    ? personalizeProduct(result.nutrition, result.traffic_light ?? null, latestRecord.answers)
    : null

  async function refreshHistory() {
    const list = await listScans()
    setHistory(list)
    setSummary(summarizeScans(list))
  }

  // 페이지 진입 계측 + 이력 로드
  useEffect(() => {
    track('scan_page_view')
    refreshHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 개인화("내 기준으로 보기") 노출 계측 — 결과가 표시될 때 1회
  useEffect(() => {
    if (!result) return
    track('scan_personalize_shown', {
      applicable: !!personal?.applicable,
      flag_count: personal?.warnings.length ?? 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  function reset() {
    setError(null); setNotFound(null); setResult(null); setAdditives(null); setSearchResults(null); setReported(false)
  }

  function stopScan() {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    setScanning(false)
  }

  useEffect(() => () => stopScan(), [])

  // 카메라 스트림 부착 + BarcodeDetector 감지 루프 (scanning 진입 시)
  useEffect(() => {
    if (!scanning) return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {})
    const AnyBD = (window as any).BarcodeDetector
    const detector = new AnyBD({ formats: BARCODE_FORMATS })
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      try {
        const codes = await detector.detect(video)
        if (codes && codes.length && codes[0]?.rawValue) {
          const val = String(codes[0].rawValue).replace(/\D/g, '')
          stopScan()
          if (/^\d{8,14}$/.test(val)) { track('scan_barcode_detected'); lookupBarcode(val) }
          else setError('바코드를 읽지 못했어요. 다시 시도하거나 이름으로 검색해 주세요.')
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
    reset()
    track('scan_camera_start')
    if (!scanSupported()) {
      track('scan_camera_unsupported')
      setError('이 브라우저는 카메라 스캔을 지원하지 않아요. 아래에서 제품 이름으로 검색해 주세요.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setScanning(true)
    } catch {
      stopScan()
      setError('카메라를 열 수 없어요. 카메라 권한을 허용했는지 확인하거나 이름으로 검색해 주세요.')
    }
  }

  async function lookupBarcode(barcode: string, source: 'barcode' | 'search' = 'barcode') {
    reset(); setLoading(true)
    try {
      const [p, a] = await Promise.allSettled([getProduct(barcode), getAdditiveSummary(barcode)])
      if (p.status === 'fulfilled') {
        const prod = p.value
        const add = a.status === 'fulfilled' ? a.value : null
        setResult(prod)
        setAdditives(add)
        track('scan_lookup_success', {
          source,
          has_nutrition: !!prod.nutrition,
          has_additives: !!add,
          food_category: prod.product.food_category ?? null,
        })
        // 이력 저장(리텐션 B축) — 제품 팩트만 저장(설문 파생 개인화는 미저장)
        const target = await saveScan(buildScanRecord(prod, add))
        track('scan_saved', { saved_to: target })
        refreshHistory()
      } else if (p.reason instanceof MeokseonNotFound) {
        setNotFound(barcode)
        track('scan_lookup_not_found')
      } else {
        setError('제품 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
        track('scan_lookup_error', { error_kind: 'fetch' })
      }
    } finally { setLoading(false) }
  }

  async function doSearch(q: string) {
    reset(); setLoading(true)
    try {
      const res = await searchProducts(q)
      setSearchResults(res)
      track('scan_search_submit', { result_count: res.length })
    } catch {
      setError('검색에 실패했어요. 잠시 후 다시 시도해 주세요.')
      track('scan_lookup_error', { error_kind: 'search' })
    } finally { setLoading(false) }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = query.trim()
    if (!v) return
    if (/^\d{8,14}$/.test(v)) lookupBarcode(v)  // 바코드를 붙여넣은 경우도 지원
    else doSearch(v)
  }

  async function onShare() {
    if (!result) return
    track('scan_share_click')
    const text = `${result.product.product_name} — 먹선에서 성분·첨가물·영양 확인`
    try {
      if (navigator.share) await navigator.share({ title: '서박사의 영양공식', text })
      else await navigator.clipboard.writeText(text)
    } catch { /* 취소 등 무시 */ }
  }

  if (!meokseonConfigured()) {
    return (
      <div className="survey-container fade-in"><div className="survey-card">
        <h2 className="survey-step-title">제품 스캔</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>제품 조회 서비스 설정이 필요합니다. (VITE_MEOKSEON_API_URL 미설정)</p>
      </div></div>
    )
  }

  // 카메라 스캔 중 화면
  if (scanning) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <h2 className="survey-step-title" style={{ fontSize: 16 }}>바코드를 화면 안에 맞춰주세요</h2>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '3 / 4', marginBottom: 14 }}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '78%', height: '32%', border: '3px solid rgba(255,255,255,0.9)', borderRadius: 12 }} />
            </div>
          </div>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={stopScan}>취소</button>
        </div>
      </div>
    )
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card" style={{ marginBottom: 16 }}>
        <h2 className="survey-step-title">내가 먹는 가공식품, 10초 해석</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
          제품 바코드를 카메라로 스캔하면 성분·첨가물·영양을 바로 보여드려요.
        </p>
        <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={startScan} disabled={loading}>
          📷 바코드 스캔하기
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px', color: 'var(--text-muted)', fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} /> 또는 이름으로 검색 <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
          <input className="input-field" placeholder="예: 신라면" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn btn-secondary" style={{ width: 'auto', padding: '12px 20px' }} disabled={loading}>
            {loading ? '조회 중…' : '검색'}
          </button>
        </form>
      </div>

      {/* ━━ 내 최근 스캔 + 주간 패턴(리텐션 B축) — 결과를 보고 있지 않을 때만 ━━ */}
      {summary && history.length > 0 && !result && !searchResults && !notFound && (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 className="survey-step-title" style={{ fontSize: 16 }}>내 최근 스캔</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>총 {summary.total}건</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
            이번 주 {summary.thisISOWeek}건 · 최근 7일 {summary.last7Days}건
            {summary.streakWeeks >= 2 ? ` · ${summary.streakWeeks}주 연속 🔥` : ''}
          </p>
          <WeekBars weeks={summary.weeks} />
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {history.slice(0, 5).map((r) => (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" className="btn btn-secondary"
                  style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                  onClick={() => lookupBarcode(r.barcode)}>
                  {r.image_url
                    ? <img src={r.image_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                    : <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--border-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍱</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {r.product_name}
                  </span>
                </button>
                <button type="button" className="btn btn-secondary" aria-label="이력 삭제"
                  style={{ width: 'auto', padding: '8px 12px', color: 'var(--text-muted)', flexShrink: 0 }}
                  onClick={async () => { await deleteScan(r.id); refreshHistory() }}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="survey-card" style={{ marginBottom: 16 }}><p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p></div>}

      {notFound && (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <h3 className="survey-step-title" style={{ fontSize: 16 }}>아직 검토 중인 제품이에요</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
            바코드 <strong>{notFound}</strong> 는 아직 데이터베이스에 없어요. 제품 앞면과 영양성분·원재료 표기를 찍어 보내주시면
            검토 후 등록해 드릴게요. (등록되면 알려드릴게요.)
          </p>
          {reported ? (
            <p style={{ color: 'var(--accent)', fontSize: 14 }}>제보 감사합니다! 검토 후 등록되면 알려드릴게요.</p>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => { setReported(true); track('scan_report_click') }}>이 제품 제보하기</button>
          )}
        </div>
      )}

      {searchResults && (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <h3 className="survey-step-title" style={{ fontSize: 16 }}>검색 결과 {searchResults.length}건</h3>
          {searchResults.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>일치하는 제품이 없어요. 바코드 스캔으로 시도해 보세요.</p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.map((it) => (
                <li key={it.product_id}>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                    disabled={!it.barcode} onClick={() => it.barcode && lookupBarcode(it.barcode, 'search')}>
                    {it.product_name}{it.brand ? ` · ${it.brand}` : ''}{!it.barcode ? ' (바코드 없음)' : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="survey-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {result.product.image_url && (
                <img src={result.product.image_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{result.product.product_name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {[result.product.brand, result.product.manufacturer, result.product.food_category].filter(Boolean).filter((s) => s !== 'general').join(' · ')}
                </p>
              </div>
            </div>
          </div>

          {additives && (
            <div className="survey-card" style={{ marginBottom: 16 }}>
              <h3 className="survey-step-title" style={{ fontSize: 16 }}>첨가물 {additives.risk_summary.total}종</h3>
              {additives.risk_summary.total === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>등록된 첨가물 정보가 없어요.</p>
              ) : (
                <>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 12px', lineHeight: 1.6 }}>
                    첨가물 안전성을 4색으로 나타내요 (먹선 위해성 평가 기준).{' '}
                    <strong style={{ color: COLOR_HEX.green }}>초록 안전</strong> → 노랑 허용 → 주황 주의 → <strong style={{ color: COLOR_HEX.red }}>빨강 위해</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['green', 'yellow', 'orange', 'red'] as const).map((c) => {
                      const n = additives.risk_summary.by_color[c]
                      return (
                        <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 11px', borderRadius: 999, background: n ? `${COLOR_HEX[c]}1a` : 'var(--border-light)', color: n ? 'var(--text)' : 'var(--text-muted)' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_HEX[c] }} />
                          {COLOR_LABEL[c]} <strong>{n}</strong>
                        </span>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {result.nutrition && (
            <div className="survey-card" style={{ marginBottom: 16 }}>
              <h3 className="survey-step-title" style={{ fontSize: 16 }}>영양성분</h3>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <tbody>
                  {NUTRIENTS.map(({ key, label, unit }) => {
                    const v = result.nutrition ? result.nutrition[key] : null
                    if (v === null || v === undefined || typeof v !== 'number') return null
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '7px 0', color: 'var(--text-secondary)' }}>{label}</td>
                        <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600 }}>{Math.round(v * 10) / 10} {unit}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {result.nutrition.source_license && /odbl/i.test(result.nutrition.source_license) && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                  일부 정보는 Open Food Facts(ODbL) 오픈DB 참고 자료입니다.
                </p>
              )}
            </div>
          )}

          {/* 내 기준으로 보기 — 먹선 신호등 색 소비(자체 판정 없음). null=판정없음(안전 아님). */}
          {personal && personal.applicable ? (
            <div className="survey-card" style={{ marginBottom: 16 }}>
              <h3 className="survey-step-title" style={{ fontSize: 16 }}>내 기준으로 보기</h3>
              {personal.warnings.length > 0 ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                    내 설문 기준으로 주의해서 볼 항목이에요. 판정은 먹선 영양 신호등 기준입니다. (진단이 아닌 생활관리 참고)
                  </p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {personal.warnings.map((f) => (
                      <li key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: f.color === 'red' ? 'var(--danger)' : 'var(--warning)' }} />
                        <span><strong>{f.label}</strong> — {f.reason}이라 주의해서 보세요. <span style={{ color: 'var(--text-muted)' }}>(먹선 신호등: {f.color === 'red' ? '빨강' : '노랑'})</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : personal.judgedCount > 0 && !personal.hasUnknown ? (
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>내 설문 기준으로 주의할 항목은 없어요. 먹선 신호등 기준 양호합니다. 🙆</p>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>이 제품은 먹선 신호등 정보가 부족해 내 기준으로 판정하기 어려워요. (안전하다는 뜻은 아니에요.)</p>
              )}
            </div>
          ) : (
            <div className="survey-card" style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              <h3 className="survey-step-title" style={{ fontSize: 16 }}>내 기준으로 보기</h3>
              <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8 }}>
                <p>· 나에게 중요한 항목 A</p>
                <p>· 나에게 중요한 항목 B</p>
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(255,255,255,0.55)', padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 280 }}>
                  설문을 연결하면 이 제품에서 <strong>나에게 중요한 항목</strong>만 골라 표시해드려요.
                </p>
                <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => { track('scan_survey_cta_click'); navigate('/survey') }}>
                  30초 설문하고 내 기준으로 보기
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onShare}>공유</button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setQuery(''); reset(); refreshHistory() }}>다른 제품 조회</button>
          </div>
        </>
      )}
    </div>
  )
}

// 최근 8주 스캔 빈도 미니 막대(결정적 요약 시각화). 빈 주는 옅게 표시.
function WeekBars({ weeks }: { weeks: ScanSummary['weeks'] }) {
  const max = Math.max(1, ...weeks.map((w) => w.n))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 32 }} aria-hidden="true">
      {weeks.map((w) => (
        <div key={w.week} title={`${w.week}: ${w.n}건`}
          style={{ flex: 1, height: `${Math.max(6, Math.round((w.n / max) * 32))}px`, background: w.n ? 'var(--primary)' : 'var(--border-light)', borderRadius: 3 }} />
      ))}
    </div>
  )
}
