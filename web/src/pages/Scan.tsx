import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLatestRecord } from '../lib/surveyHistory'
import { personalizeProduct } from '../domain/meokseon/personalize'
import { track } from '../lib/events'
import { reportScanMiss } from '../lib/scanMiss'
import {
  buildScanRecord, saveScan, listScans, deleteScan, summarizeScans, promoteLocalScans,
  type ScanRecord, type ScanSummary,
} from '../lib/scanHistory'
import { supabase } from '../lib/supabase'
import AllergenCard from '../components/AllergenCard'
import {
  getProduct, getAdditiveSummary, searchProducts, meokseonConfigured, MeokseonNotFound,
  submitPhotoReport,
  type MsProductResult, type MsAdditiveSummary, type MsSearchItem, type MsPhotoReportResult,
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

// 동명 제품 구분용 보조표기: 제조사·브랜드·분류 등에서 빈값/`general`/중복 제거 후 ' · ' 결합.
function subtitleOf(...parts: (string | null | undefined)[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of parts) {
    const v = (raw ?? '').trim()
    if (!v || v === 'general' || v === 'null') continue
    const k = v.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k); out.push(v)
  }
  return out.join(' · ')
}

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
  // 사진 제보. `reported` 는 **서버가 실제로 받은 뒤에만** true 가 된다.
  //   2026-08-06 이전에는 버튼이 로컬 상태만 바꾸고 「제보 감사합니다」를 띄웠다(거짓 확인).
  const [reported, setReported] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [labelImage, setLabelImage] = useState<File | null>(null)
  const [nutritionImage, setNutritionImage] = useState<File | null>(null)
  const [reportSending, setReportSending] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportInfo, setReportInfo] = useState<MsPhotoReportResult | null>(null)
  const [scanning, setScanning] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const [history, setHistory] = useState<ScanRecord[]>([])
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  // null = 아직 모름(깜빡임 방지). 비로그인 안내 배너는 false 일 때만 띄운다.
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  const latestRecord = getLatestRecord()
  // 개인화는 먹선 traffic_light 색을 소비(자체 임계 없음). 근거: 64 재평가 v1.
  const personal = (result && latestRecord)
    ? personalizeProduct(result.nutrition, result.traffic_light ?? null, latestRecord.answers)
    : null

  async function refreshHistory() {
    // ★ 승격을 listScans 보다 **먼저** 부른다(IP/146).
    //   AuthCallback 의 SIGNED_IN 훅만으로는 부족하다: 이미 세션이 있는 재방문자는
    //   SIGNED_IN 이 발화하지 않아 로컬 스캔이 **영원히 승격되지 않는다.**
    //   멱등이고 로컬이 비었으면 no-op(네트워크 호출 없음) → 여기서 불러도 부담 없다.
    //   순서가 뒤집히면 승격 직후 이력이 한 박자 늦게 뜬다.
    try {
      const p = await promoteLocalScans()
      if (p.status !== 'noop') {
        track('scan_promote', { status: p.status, attempted: p.attempted, promoted: p.promoted, at: 'scan_page' })
      }
    } catch { /* 승격 실패가 이력 조회를 막아선 안 된다 */ }
    const list = await listScans()
    setHistory(list)
    setSummary(summarizeScans(list))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setSignedIn(!!user)
    } catch { setSignedIn(null) }
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
    setReportOpen(false); setLabelImage(null); setNutritionImage(null)
    setReportSending(false); setReportError(null); setReportInfo(null)
  }

  async function sendPhotoReport() {
    if (!notFound) return
    setReportSending(true); setReportError(null)
    try {
      const info = await submitPhotoReport({ barcode: notFound, labelImage, nutritionImage })
      setReportInfo(info)
      setReported(true)
      track('scan_report_submit', { saved: info.saved, nutrition_count: info.nutritionCount })
    } catch (e) {
      // ★ 실패를 성공처럼 말하지 않는다. 사용자가 다시 시도할 수 있게 사유를 그대로 보여준다.
      setReportError(e instanceof Error ? e.message : '보내지 못했어요. 잠시 후 다시 시도해 주세요.')
      track('scan_report_error')
    } finally { setReportSending(false) }
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
        // A-1 미스 큐: 보강 파이프라인 입력 (익명, 바코드만 — scanMiss.ts 참조)
        if (source === 'barcode') reportScanMiss(barcode)
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
          {/* ★ 비로그인 저장 위치 고지(IP/146). 화면엔 이력이 멀쩡히 보이므로
              사용자는 저장됐다고 믿는다 — 실제로는 이 기기에만 있다. 그걸 말해준다.
              로그인하면 promoteLocalScans() 가 이 이력을 서버로 올린다(유실 아님). */}
          {signedIn === false && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '8px 10px', marginBottom: 10, borderRadius: 8,
              background: 'var(--border-light)', fontSize: 12, lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}>
              <span style={{ flex: 1, minWidth: 180 }}>
                이 이력은 지금 <strong>이 기기에만</strong> 저장돼 있어요.
                로그인하면 그대로 옮겨져 기기를 바꿔도 유지됩니다.
              </span>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => { track('scan_login_cta_click', { local_n: history.length }); navigate('/login') }}>
                로그인
              </button>
            </div>
          )}
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
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product_name}</span>
                    {subtitleOf(r.brand, r.food_category) && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitleOf(r.brand, r.food_category)}</span>
                    )}
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
          {reported && reportInfo ? (
            <div>
              <p style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 6 }}>
                {reportInfo.saved
                  ? '제보 감사합니다! 검토 후 등록되면 알려드릴게요.'
                  : '사진은 잘 받았어요. 다만 자동 등록 기준에 못 미쳐 사람이 직접 확인할게요.'}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                읽어낸 내용 — 제품명 {reportInfo.productName || '미인식'} · 영양성분 {reportInfo.nutritionCount}개
                {reportInfo.allergens.length > 0 && ` · 알레르기 ${reportInfo.allergens.join(', ')}`}
                {reportInfo.nutritionCount === 0 && ' (영양성분표가 흐릿하면 다시 찍어 주시면 더 정확해져요.)'}
              </p>
            </div>
          ) : !reportOpen ? (
            <button
              type="button" className="btn btn-secondary"
              onClick={() => { setReportOpen(true); track('scan_report_click') }}
            >이 제품 제보하기</button>
          ) : (
            <div>
              {/* 한 장만으로도 보낼 수 있지만, 두 장을 권한다.
                  법정 알레르기 표기가 영양성분표 «옆»에 인쇄된 제품이 흔해서
                  라벨 한 장만 보내면 경고를 놓친다(서버 세션44 치명B 실측). */}
              {/* 입력은 숨기고 label 을 버튼처럼 쓴다 — Meal.tsx 와 같은 패턴. */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  ① 원재료 · 알레르기 표기 {labelImage && <span style={{ color: 'var(--accent)' }}>✓ 선택됨</span>}
                </div>
                <label className={labelImage ? 'btn btn-secondary' : 'btn btn-primary'}
                  style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                  📷 {labelImage ? '다시 찍기' : '촬영 / 사진 고르기'}
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={(e) => { setLabelImage(e.target.files?.[0] ?? null); setReportError(null) }} />
                </label>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  ② 영양성분표 {nutritionImage && <span style={{ color: 'var(--accent)' }}>✓ 선택됨</span>}
                </div>
                <label className={nutritionImage ? 'btn btn-secondary' : 'btn btn-primary'}
                  style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                  📷 {nutritionImage ? '다시 찍기' : '촬영 / 사진 고르기'}
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={(e) => { setNutritionImage(e.target.files?.[0] ?? null); setReportError(null) }} />
                </label>
              </div>

              {reportError && (
                <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{reportError}</p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button" className="btn btn-primary" style={{ flex: 1 }}
                  disabled={reportSending || (!labelImage && !nutritionImage)}
                  onClick={sendPhotoReport}
                >{reportSending ? '보내는 중…' : '보내기'}</button>
                <button
                  type="button" className="btn btn-secondary"
                  disabled={reportSending}
                  onClick={() => { setReportOpen(false); setLabelImage(null); setNutritionImage(null); setReportError(null) }}
                >취소</button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                한 장만 보내도 되지만, 두 장을 다 보내면 알레르기·영양을 훨씬 정확하게 읽어요. (사진당 10MB 이하)
              </p>
            </div>
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
                  <button type="button" className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                    disabled={!it.barcode} onClick={() => it.barcode && lookupBarcode(it.barcode, 'search')}>
                    {it.image_url
                      ? <img src={it.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      : <span style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--border-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍱</span>}
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product_name}{!it.barcode ? ' (바코드 없음)' : ''}</span>
                      {subtitleOf(it.manufacturer, it.brand, it.food_type) && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitleOf(it.manufacturer, it.brand, it.food_type)}</span>
                      )}
                    </span>
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

          {/* ★ 알레르기는 안전 항목이라 첨가물·영양보다 «먼저» 온다.
              미수집일 때도 카드를 띄운다 — 침묵은 「없음」으로 읽힌다. */}
          <AllergenCard result={result} />

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
