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
import AdditiveList from '../components/AdditiveList'
import {
  buildAdditiveList, COLOR_LABEL, SHOW_RISK_GRADE, describeAdditiveCount, GRADE_HIDDEN_NOTICE,
  type AdditiveColor,
} from '../domain/meokseon/additives'
import { assessProduct, GAP_HELP_TEXT } from '../domain/meokseon/productCompleteness'
import {
  getProduct, getAdditiveSummary, searchProducts, meokseonConfigured, MeokseonNotFound,
  analyzePhotoReport, confirmPhotoReport, MeokseonConfirmError, MeokseonAuthError,
  type MsProductResult, type MsAdditiveSummary, type MsSearchItem, type MsPhotoAnalysis,
} from '../lib/meokseon'
import { getMeokseonAccessToken } from '../lib/meokseonAuth'
import { loginPathWithReturn } from '../lib/returnTo'
import {
  seedProductNameForExisting, canSubmitReport, checkProductName, classifyConfirmFailure, describeReadback,
  classifyPhotoReportOutcome, NUTRITION_RETAKE_CTA,
  CONFIRM_FALLBACK_MESSAGE,
} from '../domain/meokseon/photoReport'
import {
  REPORT_LOGIN_HEADLINE, REPORT_LOGIN_WHY, REPORT_LOGIN_SCAN_OK, REPORT_LOGIN_CTA,
  REPORT_LOGIN_DISMISS, REPORT_LOGIN_RETURN_NOTICE,
  AUTH_PHOTO_LOST_NOTICE, AUTH_RELOGIN_CTA,
} from '../domain/meokseon/reportAuth'
import {
  buildReportNutrition, TRAFFIC_LIGHT_CAPTION,
} from '../domain/meokseon/reportNutrition'
import { CONTRIBUTIONS_TITLE } from '../domain/meokseon/contributions'

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

// ★ `unknown`(회색)은 세션64 추가 — 서버가 4색 «밖»의 등급을 줄 수 있다
//   (`productService.js:120` 의 'gray' 폴백, `mfras_grade` ENUM 의 'blue' 잔재).
//   4색만 그리면 그런 첨가물은 「N종」에 세어 놓고 화면에서 조용히 사라진다.
const COLOR_HEX: Record<AdditiveColor, string> = {
  green: '#4a9e3f', yellow: '#f59e0b', orange: '#ea580c', red: '#ef4444', unknown: '#6b7280',
}
// 먹선 위해성 평가(MFRAS) 색 의미 — 정본은 domain/meokseon/additives.ts 의 COLOR_LABEL.
// ⚠ 여기서 다시 정의하지 않는다(두 곳에 두면 갈라진다).
const PILL_COLORS: AdditiveColor[] = ['green', 'yellow', 'orange', 'red']
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

/**
 * 영양 신호등 색. ⚠ 첨가물 4색(`COLOR_HEX`)과 **다른 축**이다 — 같은 상수를 돌려쓰지 말 것.
 *   여기 회색이 없는 것은 의도다: 판정되지 않은 항목은 `reportNutrition.ts` 가
 *   목록에서 «빼고», 그 사실을 «말»로 한다(회색 점을 그리면 「판정했다」로 읽힌다).
 */
const LIGHT_HEX: Record<'green' | 'yellow' | 'red', string> = {
  green: '#4a9e3f', yellow: '#f59e0b', red: '#ef4444',
}

/** 「내가 보낸 제보」 화면. ⚠ `App.tsx` 의 라우트와 «같은 값»이어야 한다. */
const MY_REPORTS_PATH = '/scan/reports'

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
  // 사진 제보 — ★ 세션64: **두 단계**다(읽어보기 → 제품명 확인 → 보내기).
  //   1단계는 저장하지 않는다. 저장은 사용자가 제품명을 확정한 뒤에만 일어난다.
  //   근거·문구·판정은 전부 domain/meokseon/photoReport.ts. 여기서 다시 판단하지 않는다.
  const [reportOpen, setReportOpen] = useState(false)
  const [labelImage, setLabelImage] = useState<File | null>(null)
  const [nutritionImage, setNutritionImage] = useState<File | null>(null)
  // 1단계 결과. null 이면 아직 안 읽었거나 «폐기»된 것이다(사진 교체·토큰 만료).
  const [analysis, setAnalysis] = useState<MsPhotoAnalysis | null>(null)
  // ★ 정본 제품명. OCR 값은 여기 «초기값»으로만 들어온다(제이 결정 ①).
  const [productName, setProductName] = useState('')
  const [reportBusy, setReportBusy] = useState<'analyze' | 'confirm' | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  // 2단계 성공 후에만 채워진다. **서버가 실제로 받은 뒤에만** true 가 된다.
  //   2026-08-06 이전에는 버튼이 로컬 상태만 바꾸고 「제보 감사합니다」를 띄웠다(거짓 확인).
  //   ★ 2026-08-23 — `rejectReason` 을 함께 담는다. 서버는 반려할 때도 200 + save_result 객체를
  //     주므로, 사유를 안 들고 오면 화면이 반려를 「감사합니다」로 말한다(거짓 확인).
  //   ★★ 2026-08-23 세션64b — `nutritionStatus`·`nutritionRejectCode` 를 함께 담는다.
  //     서버가 「부분 저장」(영양만 버리고 나머지는 저장)을 시작했다. `saved` 만 보면
  //     화면이 「제보 감사합니다」를 띄우고 사용자는 **영양이 안 들어간 걸 모른 채** 떠난다.
  //     ⚠ 문구 판정은 여기서 하지 않는다 — `domain/meokseon/photoReport.ts` 가 정본이다.
  const [confirmed, setConfirmed] = useState<{
    saved: boolean
    rejectReason: string | null
    nutritionStatus: string | null
    nutritionRejectCode: string | null
  } | null>(null)
  /**
   * ★★ 2026-08-24 세션64c — 「제보하려면 로그인이 필요해요」 패널.
   *   ⚠ 스캔·조회는 «막지 않는다». 이 게이트는 제보 버튼에만 붙는다(reportAuth.ts ①).
   *   ⚠ 사진을 «고르기 전»에 뜬다. 폼을 열어 준 뒤 보내기에서 막으면 매직링크 왕복 때문에
   *     사진이 사라져 두 번 찍게 된다(reportAuth.ts ②).
   */
  const [loginGateOpen, setLoginGateOpen] = useState(false)
  /**
   * 폼이 «열린 뒤» 세션이 끊겨 401 을 받은 상태. 여기서 우리가 마음대로 로그인 화면으로
   * 옮기지 않는다 — 옮기는 순간 방금 찍은 사진이 말없이 사라진다(reportAuth.ts ③).
   */
  const [authBlocked, setAuthBlocked] = useState(false)
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

  // 첨가물 «개별» 뷰 모델. 판정·문구는 전부 domain/meokseon/additives.ts 의 순수 함수다.
  // ★ 색별 개수도 여기서 «다시» 센다 — 서버 `risk_summary.by_color` 는 4색만 세므로
  //   4색 밖(gray·blue) 첨가물이 어느 칸에도 안 잡히고 화면에서 사라진다.
  const additiveView = additives ? buildAdditiveList(additives) : null

  /**
   * ★★ 2026-08-23 세션64 외부검토 §B — 제보 경로를 «미등록 바코드» 밖으로 넓힌다.
   *
   *   종전에는 제보 UI 가 `notFound` 일 때만 떴다. ⇒ 영양정보가 빈 채로 한 번 등록되면
   *   그 제품은 「있음」이 되어 **다시는 제보 화면이 뜨지 않는다.** 고칠 경로가 없었다.
   *   (검토자 표현: 「낮은 품질의 첫 제보가 미래의 고품질 제보를 차단한다.」)
   *
   *   결손 판정은 여기서 하지 않는다 — `domain/meokseon/productCompleteness.ts` 의 순수 함수다.
   *   ⚠ 그 함수는 원재료를 「없다」가 아니라 «모른다»(unknown)로 낼 수 있다.
   *     현 서버 응답에 원재료 키가 아예 없기 때문이다. 모르는 것을 없다고 말하지 않는다.
   */
  const completeness = result ? assessProduct(result) : null
  // 제보 대상 바코드 — 미등록(notFound)과 등록된 제품(result) 양쪽을 하나로 다룬다.
  const reportBarcode = notFound ?? result?.product.barcode ?? null
  // 이미 등록된 제품이면 이름이 «이미 있다». 입력란을 비워 두고 시키면 안 된다.
  const registeredName = result?.product.product_name ?? null

  // 사진 제보 2단계 — 자동채움 결과와 전송 게이트. 판정은 domain/meokseon/photoReport.ts.
  const nameSeed = analysis ? seedProductNameForExisting(registeredName, analysis.productName) : null
  const submitGate = canSubmitReport({
    analysisToken: analysis?.analysisToken ?? null,
    productName,
    busy: reportBusy !== null,
  })

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
    restoreFromLogin()
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
    setError(null); setNotFound(null); setResult(null); setAdditives(null); setSearchResults(null)
    setReportOpen(false); setLabelImage(null); setNutritionImage(null)
    setReportBusy(null); setReportError(null)
    setAnalysis(null); setProductName(''); setConfirmed(null)
    setLoginGateOpen(false); setAuthBlocked(false)
  }

  /* ────────────────────────────────────────────────────────────────────────
   * 제보 로그인 게이트 (세션64c · 2026-08-24 제이 확정 「제보도 로그인 필수」)
   *
   * ★ 판정·문구는 `domain/meokseon/reportAuth.ts` 가 정본이다. 여기서 다시 적지 않는다.
   * ★ 새 인증 흐름을 «만들지 않았다» — 기존 `/login`(매직링크) → `/auth/callback` 그대로다.
   *   달라진 것은 복귀 경로를 URL 로 실어 보낸다는 것 하나뿐이다(`lib/returnTo.ts`).
   * ──────────────────────────────────────────────────────────────────────── */

  /**
   * 로그인 뒤 돌아올 자리. **바코드를 URL 에 실어야** 사용자가 다시 스캔하지 않는다.
   * ⚠ 사진(File)은 여기 실을 수 없다. 매직링크는 페이지를 새로 열기 때문이다 —
   *   그래서 게이트가 사진을 «고르기 전»에 뜬다.
   */
  function reportReturnPath(): string {
    return reportBarcode
      ? `/scan?barcode=${encodeURIComponent(reportBarcode)}&report=1`
      : '/scan'
  }

  /** 제보 폼을 연다. 로그인 안 돼 있으면 폼 «대신» 게이트를 띄운다. */
  async function openReportForm(source: string) {
    // 계측은 종전과 같은 이벤트·키를 쓴다(`ALL_APP_EVENTS` 는 DB CHECK 와 1:1 — 이름을 늘리지 않는다).
    track('scan_report_click', { source })
    const token = await getMeokseonAccessToken()
    if (!token) { setLoginGateOpen(true); return }
    setLoginGateOpen(false); setAuthBlocked(false); setReportOpen(true)
  }

  /** 로그인 화면으로. 돌아올 자리를 «URL 로» 들고 간다. */
  function goLoginForReport(source: string) {
    track('scan_login_cta_click', { source })
    navigate(loginPathWithReturn(reportReturnPath()))
  }

  /**
   * 흐름 «도중»의 401. 폼은 이미 열려 있고 사진도 골라 놨다.
   * ⚠ 여기서 `navigate('/login')` 을 부르지 «않는다». 부르는 순간 방금 고른 사진이
   *   말없이 사라진다. 사실(`AUTH_PHOTO_LOST_NOTICE`)을 말하고 버튼으로 «선택»을 준다.
   * ⚠ 문구는 `MeokseonAuthError` 가 이미 들고 있다(정본은 domain/meokseon/reportAuth.ts).
   */
  /**
   * ★★ 로그인에서 «돌아왔을 때» — `/scan?barcode=…&report=1`.
   *
   *   매직링크는 페이지를 새로 열기 때문에 React 상태가 전부 사라진다. 그래서 복귀 지점을
   *   URL 로 들고 왔다. 여기서 바코드를 다시 조회하고 제보 폼을 «열어 준다» —
   *   그렇게 하지 않으면 사용자는 로그인만 하고 **바코드부터 다시 스캔**해야 한다.
   *
   * ⚠ 사진은 복원할 수 없다(File 은 URL 로 넘길 수 없다). 그래서 게이트가 사진을 고르기
   *   «전»에 뜨도록 만들어 뒀다 — 이 경로로 오는 사용자는 아직 사진을 고르지 않았다.
   * ⚠ URL 은 즉시 지운다(`replaceState`). 안 지우면 새로고침·뒤로가기마다 조회가 반복된다.
   */
  async function restoreFromLogin() {
    let sp: URLSearchParams
    try { sp = new URLSearchParams(window.location.search) } catch { return }
    const raw = sp.get('barcode') || ''
    const wantReport = sp.get('report') === '1'
    const bc = raw.replace(/\D/g, '')
    if (!/^\d{8,14}$/.test(bc)) return
    try { window.history.replaceState({}, '', '/scan') } catch { /* 무시 */ }
    await lookupBarcode(bc)
    // ⚠ `lookupBarcode` 가 `reset()` 으로 폼을 닫으므로 «그 뒤»에 연다. 순서를 바꾸지 말 것.
    if (wantReport) await openReportForm('login_return')
  }

  function handleAuthError(e: MeokseonAuthError, stage: 'analyze' | 'confirm') {
    setReportError(e.message)
    setAuthBlocked(true)
    // 새 이벤트 이름을 만들지 않는다 — 기존 화이트리스트 키 `error_kind` 로 구분한다.
    track('scan_report_error', { error_kind: `auth_${e.code.toLowerCase()}_${stage}` })
  }

  /**
   * ★★ 읽어본 결과를 버린다 — 사진을 다시 고르거나 토큰이 만료됐을 때.
   * 낡은 토큰으로 저장하면 **화면에 보이는 것과 «다른 사진»이 저장된다.** 반드시 함께 버린다.
   * (제품명도 같이 비운다 — 앞 사진의 OCR 값이 남아 다음 제품 이름이 되면 안 된다.)
   */
  function discardAnalysis() {
    setAnalysis(null); setProductName(''); setReportError(null)
  }

  /**
   * ★★ 세션64b — 「영양성분표만 다시 찍기」. 부분 저장(영양 미확보) 뒤에만 나오는 길이다.
   *
   * ⚠ **라벨 사진(`labelImage`)은 남긴다.** 영양성분표만 다시 찍으면 되는 상황에서
   *   두 장을 다 다시 찍게 만들면 사용자가 그냥 떠난다. 안내만 하고 길을 안 주는 것과 같다.
   * ⚠ 토큰(`analysis`)은 **반드시** 버린다. 낡은 토큰으로 저장하면 화면과 다른 사진이 들어간다.
   * ⚠ `confirmed` 도 버린다 — 안 버리면 완료 화면이 그대로 남아 폼이 안 돌아온다.
   */
  function retakeNutritionPhoto() {
    setConfirmed(null); setNutritionImage(null)
    setAnalysis(null); setProductName(''); setReportError(null)
  }

  /** 1단계 — 읽어보기. 저장하지 않는다. */
  async function analyzePhotos() {
    // ★ 2026-08-23 — `notFound` 가 아니라 `reportBarcode` 다. 등록된 제품에도 보탤 수 있어야 한다.
    if (!reportBarcode) return
    setReportBusy('analyze'); setReportError(null)
    try {
      const a = await analyzePhotoReport({ barcode: reportBarcode, labelImage, nutritionImage })
      setAnalysis(a)
      // OCR 값은 «자동채움»일 뿐이다. 못 읽었으면 빈칸으로 두고 안내문이 이유를 말한다.
      // ★ 이미 등록된 제품이면 «등록된 이름»이 OCR 값보다 우선한다(서버 UPDATE 가 덮어쓰지 않으므로).
      setProductName(seedProductNameForExisting(registeredName, a.productName).value)
    } catch (e) {
      // ★ 401 을 일반 실패로 뭉개지 않는다 — 사용자가 할 일이 「로그인」으로 다르다.
      if (e instanceof MeokseonAuthError) { handleAuthError(e, 'analyze'); return }
      setReportError(e instanceof Error ? e.message : CONFIRM_FALLBACK_MESSAGE)
      // ⚠ 새 이벤트 이름을 만들지 않는다 — `ALL_APP_EVENTS` 는 DB CHECK 제약과 1:1 이라
      //   여기만 늘리면 INSERT 가 «조용히» 거부된다(events_db_sync.test.ts). 단계는 error_kind 로 구분.
      track('scan_report_error', { error_kind: 'analyze' })
    } finally { setReportBusy(null) }
  }

  /** 2단계 — 보내기(확정 저장). 제품명이 없으면 여기까지 오지 않는다. */
  async function confirmReport() {
    if (!analysis?.analysisToken) return
    const name = checkProductName(productName)
    if (!name.ok) { setReportError(name.reason); return }

    setReportBusy('confirm'); setReportError(null)
    try {
      const r = await confirmPhotoReport({
        analysisToken: analysis.analysisToken,
        productName: name.value,
        barcode: reportBarcode,
      })
      setConfirmed({
        saved: r.saved,
        rejectReason: r.rejectReason,
        nutritionStatus: r.nutritionStatus,
        nutritionRejectCode: r.nutritionRejectCode,
      })
      // ★★ 세션64b 계측 — 「부분 저장」은 새 «결과 상태»지만 새 «이벤트 이름»을 만들지 않는다.
      //   `ALL_APP_EVENTS` 는 DB CHECK 제약과 1:1 이라 이름을 늘리면 INSERT 가 «조용히» 거부된다
      //   (`events_db_sync.test.ts` 가 `supabase/149_*.sql` 과 대조한다).
      //   → 기존 화이트리스트 키 `error_kind` 로 구분한다. 위 실패 계측이 `confirm_*` 를 쓰는 것과
      //     같은 관용구다(`nutrition_*` 접두로 실패 계열과 섞이지 않게 한다).
      //   집계법: 전부 저장 = saved && error_kind 없음 / 부분 저장 = saved && error_kind 있음.
      //   ⚠ `nutrition_UNKNOWN` 이 관측되면 **서버가 사유 코드를 늘렸다는 뜻**이다. 그때 문구를 붙인다.
      //   ⚠ `nutrient_count`(서버 관측값)는 «보내지 않는다» — 기존 `nutrition_count` 는 1단계에서
      //     OCR 이 읽은 개수라 의미가 다르고, 한 키에 두 출처를 섞으면 지표가 조용히 오염된다.
      const outcome = classifyPhotoReportOutcome({
        saved: r.saved,
        rejectReason: r.rejectReason,
        nutritionStatus: r.nutritionStatus,
        nutritionRejectCode: r.nutritionRejectCode,
        target: 'new',   // 계측에는 문구가 안 쓰이므로 어느 쪽이든 코드가 같다
      })
      track('scan_report_submit', {
        saved: r.saved,
        nutrition_count: analysis.nutritionCount,
        error_kind: (outcome.kind === 'partial' && outcome.nutritionCode)
          ? `nutrition_${outcome.nutritionCode}`
          : null,
      })
    } catch (e) {
      // ★ 401 을 «먼저» 가른다. `MeokseonConfirmError` 로 뭉개지면 「잠시 후 다시 시도해 주세요」가
      //   나가고, 사용자는 로그인하면 될 일을 영영 모른다.
      if (e instanceof MeokseonAuthError) { handleAuthError(e, 'confirm'); return }
      // ★ 실패를 성공처럼 말하지 않는다. 사용자가 다시 시도할 수 있게 사유를 그대로 보여준다.
      if (e instanceof MeokseonConfirmError) {
        const f = classifyConfirmFailure(e.status, e.serverMessage)
        // 410 = 토큰 만료 → 토큰을 버리고 1단계로 되돌린다. **사진은 남긴다**(다시 찍게 하지 않는다).
        if (f.backToAnalyze) { setAnalysis(null); setProductName('') }
        setReportError(f.message)
        track('scan_report_error', { error_kind: `confirm_${f.kind}` })
      } else {
        setReportError(e instanceof Error ? e.message : CONFIRM_FALLBACK_MESSAGE)
        track('scan_report_error', { error_kind: 'confirm_network' })
      }
    } finally { setReportBusy(null) }
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

  /**
   * ★★ 제보 로그인 게이트 — 「제보하려면 로그인이 필요해요」.
   *
   * ⚠ 문구를 여기 다시 적지 말 것. 정본은 `domain/meokseon/reportAuth.ts` 한 곳이다.
   * ⚠ 이 패널이 뜬 자리에는 **사진 입력이 없다.** 사진을 고르게 해 놓고 나중에 막으면
   *   매직링크 왕복에 사진이 사라져 두 번 찍게 된다(reportAuth.ts ②).
   * ⚠ 「나중에 할게요」를 «반드시» 남긴다. 닫을 길 없는 벽은 스캔까지 막힌 것처럼 읽힌다.
   */
  function renderLoginGate() {
    return (
      <div
        data-testid="report-login-gate"
        style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 10,
          border: '1px solid var(--border-light)', background: 'var(--border-light)',
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {REPORT_LOGIN_HEADLINE}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>
          {REPORT_LOGIN_WHY}
        </p>
        {/* ★ 「스캔은 그대로 된다」를 반드시 함께 말한다. 없으면 사용자는 스캔도 막힌 줄 알고 떠난다. */}
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>
          {REPORT_LOGIN_SCAN_OK}
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
          {REPORT_LOGIN_RETURN_NOTICE}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button" className="btn btn-primary" style={{ width: 'auto', padding: '10px 16px' }}
            onClick={() => goLoginForReport('report_gate')}
          >{REPORT_LOGIN_CTA}</button>
          <button
            type="button" className="btn btn-secondary" style={{ width: 'auto', padding: '10px 16px' }}
            onClick={() => setLoginGateOpen(false)}
          >{REPORT_LOGIN_DISMISS}</button>
        </div>
      </div>
    )
  }

  /**
   * ★★ 사진 제보 폼 — **미등록 제품과 등록된 제품이 «같은 화면»을 쓴다.**
   *
   *   `kind: 'new'`      바코드가 DB 에 없다(종전 경로).
   *   `kind: 'existing'` 이미 등록된 제품에 정보를 보탠다(2026-08-23 §B 신설).
   *
   * ⚠ **새 플로우를 만들지 않았다.** 1단계(`analyzePhotoReport`) → 2단계(`confirmPhotoReport`)
   *   그대로다. 갈라지는 것은 «문구»뿐이다. 두 벌로 만들면 한쪽만 고쳐지는 사고가 난다
   *   (이 저장소가 세션44·47 에 이미 두 번 겪었다).
   *
   * ⚠ 컴포넌트로 «분리하지 않았다.** 상태 15개가 이 함수 스코프에 있고,
   *   `pages/__tests__/Scan_allergen_wiring.test.ts` 가 이 파일의 소스 문자열로 배선을 지킨다.
   *   다른 파일로 옮기면 그 가드가 조용히 눈이 먼다. 훅을 쓰지 않는 순수 렌더 함수다.
   */
  function renderReportForm(kind: 'new' | 'existing') {
    if (confirmed && analysis) {
      // ★★ 세션64b — 「저장됐다」와 「영양은 못 읽었다」를 **한 화면에서 동시에** 말한다.
      //   판정·문구는 전부 `domain/meokseon/photoReport.ts` 가 만든다(정본은 «거기 한 곳»이다).
      //   ⚠ 여기에 문구를 다시 적지 말 것 — 두 곳에 두면 갈라진다(additives.ts 와 같은 규칙).
      const outcome = classifyPhotoReportOutcome({
        saved: confirmed.saved,
        rejectReason: confirmed.rejectReason,
        nutritionStatus: confirmed.nutritionStatus,
        nutritionRejectCode: confirmed.nutritionRejectCode,
        target: kind,
      })
      /**
       * ★★★★ 세션64c — 「제보 직후에 결과를 돌려준다」(제이 지시 2026-08-24).
       *   서버는 1단계 응답에 원재료·첨가물·영양·신호등을 **처음부터 다 실어 보내고 있었다.**
       *   `parsePhotoAnalysis` 가 세션64b 에 그것들을 살려 뒀는데, **화면이 아직 안 그렸다.**
       *   제보자는 사진 두 장을 보내고 「감사합니다 · 원재료 12개」만 받았다.
       *
       * ⚠ 영양·신호등은 **저장된 경우에만** 낸다. 판정은 `reportNutrition.ts` 가 한다 —
       *   여기서 다시 판단하지 않는다. 그 함수는 관문을 두 겹으로 둔다:
       *     ① 서버가 영양을 저장했는가   ② 표기 기준(basis)을 아는가
       *   기준을 모르는 수치로 색을 칠하면 **색이 뒤집힌다**(과소경고).
       * ⚠ 저장 «안» 된 경우의 문구는 위 `outcome.nutritionNote` 가 이미 말한다.
       *   여기서 또 말하면 화면이 같은 얘기를 두 번 하거나 서로 다른 말을 한다.
       */
      const reportNutrition = buildReportNutrition({
        nutritionStatus: confirmed.nutritionStatus,
        nutrition: analysis.nutrition,
        basis: analysis.nutritionBasis,
        trafficLight: analysis.trafficLight,
      })
      /**
       * 첨가물 — **바코드 경로와 «같은» 컴포넌트·같은 순수함수**를 쓴다.
       * ⚠ OCR 경로의 행에는 등급·IARC·ADI 가 없다. 그래도 화면이 갈라지지 않는 이유는
       *   `SHOW_RISK_GRADE` 가 꺼져 있어 이름과 「일반적 용도」만 그리기 때문이다.
       *   그 상수를 켜기 전에 이 경로를 다시 봐야 한다(등급이 전부 「미상」으로 나간다).
       * ⚠ `risk_summary` 를 지어내지 않는다 — 없으면 `buildAdditiveList` 가 목록 길이를 쓴다.
       */
      const reportAdditives = buildAdditiveList({ additives: analysis.additives })
      return (
        <div>
          <p style={{ color: outcome.kind === 'saved' ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 14, marginBottom: 6 }}>
            {outcome.headline}
          </p>
          {/* ★★★ 부분 저장 — 「저장됐다」 바로 «아래»에서 「영양은 못 읽었다」를 말한다.
              둘 중 하나만 말하면 거짓이다. 이 블록을 지우면 사용자는 영양이 빠진 걸 모른다.
              ⚠ 조건을 `outcome.nutritionNote` 로 둔다 — 사유 코드를 몰라도(=UNKNOWN) 뜬다.
                코드 목록으로 조건을 걸면 서버가 코드를 늘리는 순간 화면이 «조용해진다». */}
          {outcome.nutritionNote && (
            <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, marginBottom: 8, padding: '10px 12px', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)', borderRadius: 'var(--radius-sm)' }}>
              {outcome.nutritionNote}
            </p>
          )}
          {/* 말만 하고 길을 안 주면 안내가 아니다. 다시 찍어도 소용없는 사유
              (PUBLIC_DATA_PROTECTED)에는 «버튼을 내지 않는다» — 헛수고를 시키지 않는다. */}
          {outcome.retakeable && (
            <button
              type="button" className="btn btn-secondary"
              style={{ width: 'auto', padding: '8px 14px', marginBottom: 10 }}
              onClick={() => { track('scan_report_click', { source: 'nutrition_retake' }); retakeNutritionPhoto() }}
            >{NUTRITION_RETAKE_CTA}</button>
          )}
          {/* ★ 제품명은 «사용자가 확정한 값»을 그대로 되읽어 준다.
              OCR 값(analysis.productName)이 아니다. 그걸 보여주면 화면과 DB 가 또 어긋난다.
              ⚠ 세션64b — 여기 있던 `analysis.nutritionCount === 0 && '(…다시 찍어 주시면…)'`
                한 줄은 지웠다. 그건 «1단계에서 OCR 이 읽은 개수»만 봤기 때문에,
                8개를 읽고도 서버가 기준을 몰라 떨어뜨린 경우(BASIS_UNKNOWN)에 **침묵했다.**
                이제 위 `nutritionNote` 가 서버 판정을 근거로 모든 경우를 말한다. */}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            보낸 내용 — 제품명 <strong>{productName}</strong> · {describeReadback(analysis)}
          </p>
          {/* ★★★★ 세션61 `U60-7` — 여기 있던 한 줄
                {reportInfo.allergens.length > 0 && ` · 알레르기 …`}
              이 **목록이 비면 아무것도 그리지 않았다.** 침묵이다.
              `domain/meokseon/allergens.ts:15` 가 그걸 경고한다 —
              「아무 표시도 안 하면 사용자는 «안전하다»고 읽는다」.

              실측(세션61 · 실물 67건): 목록이 비는 라벨 24건(35.8%) 중
                · 실제로 «직접 함유»가 있는 것    7건 (29.2%)
                · 혼입까지 세면 알려줄 게 있는 것 15건 (62.5%)
              같은 24건을 바코드 경로로 보면 **전부** 무언가를 말해 준다.

              ⇒ 바코드 경로와 «같은 카드»를 쓴다. 그래야 두 경로가 갈라지지 않는다.
              ⚠ 이 카드를 다시 한 줄짜리 텍스트로 되돌리지 말 것. 되돌리면 침묵이 돌아온다. */}
          <AllergenCard result={analysis} />

          {/* ───── 세션64c — 「보여줄 수 있는 부분만 보여주고, 나머지는 나중에」(제이 2026-08-24) ─────
              원재료 → 첨가물 → 영양·신호등 순. 알레르기가 «먼저»인 것은 안전 항목이기 때문이다. */}

          {/* 원재료 — 라벨 표기 순서 그대로. 못 읽었으면 목록 자체를 그리지 않는다
              (그 사실은 위 `describeReadback` 의 「원재료 0개」가 이미 말한다). */}
          {analysis.ingredients.length > 0 && (
            <div style={{ marginTop: 14 }} data-testid="report-ingredients">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>원재료</div>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {analysis.ingredients.map((it) => (
                  [it.name, it.origin, it.percentage !== null ? `${it.percentage}%` : null]
                    .filter(Boolean).join(' ')
                )).join(', ')}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.55 }}>
                사진에서 읽어낸 그대로예요. 라벨과 다르면 라벨이 맞아요.
              </p>
            </div>
          )}

          {/* 첨가물 — ⚠ 4색 등급은 계속 «꺼진» 상태다(`SHOW_RISK_GRADE`). 여기서 켜지 않는다.
              외부 검토 6명이 일치해서 끈 것이다. 화면은 이름과 「일반적 용도」만 그린다. */}
          {reportAdditives.total > 0 && (
            <div style={{ marginTop: 14 }} data-testid="report-additives">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {SHOW_RISK_GRADE ? `첨가물 ${reportAdditives.total}종` : describeAdditiveCount(reportAdditives.total)}
              </div>
              {!SHOW_RISK_GRADE && (
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.6 }}>
                  {GRADE_HIDDEN_NOTICE}
                </p>
              )}
              <AdditiveList view={reportAdditives} />
            </div>
          )}

          {/* ★★★ 영양·신호등 — **`reportNutrition.show` 가 참일 때만** 그린다.
              그 판정에는 「서버가 저장했는가」와 「표기 기준을 아는가」가 둘 다 들어 있다.
              여기에 `analysis.nutrition &&` 같은 조건을 «더하지» 말 것 — 관문이 두 곳으로
              갈라져 한쪽만 고쳐지는 순간 기준 없는 숫자가 새어 나간다. */}
          {reportNutrition.show && (
            <div style={{ marginTop: 14 }} data-testid="report-nutrition">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>영양성분</span>
                {/* ★ 기준 문구는 숫자와 «항상» 함께 나간다. 없으면 숫자의 뜻이 3~5배 달라진다. */}
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{reportNutrition.basisLabel}</span>
              </div>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <tbody>
                  {reportNutrition.rows.map((r) => (
                    <tr key={r.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '6px 0', color: 'var(--text-secondary)' }}>{r.label}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                        {Math.round(r.value * 10) / 10} {r.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 신호등 — 판정된 항목만 온다(회색은 `lights` 에 들어오지 않는다). */}
              {reportNutrition.showLights && (
                <div style={{ marginTop: 10 }} data-testid="report-traffic-light">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {reportNutrition.lights.map((l) => (
                      <span key={l.key} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
                        padding: '5px 11px', borderRadius: 999,
                        background: `${LIGHT_HEX[l.color]}1a`, color: 'var(--text)',
                      }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: LIGHT_HEX[l.color] }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                  {/* ★ 초록을 「안전 인증」으로 읽지 않게 하는 한 줄. 색이 뜨면 «항상» 함께 나간다. */}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55 }}>
                    {TRAFFIC_LIGHT_CAPTION}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 신호등을 «못» 그린 이유. ⚠ 조건을 색 목록으로 걸지 않는다 — 침묵이 돌아온다. */}
          {reportNutrition.note && (
            <p data-testid="report-nutrition-note" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
              {reportNutrition.note}
            </p>
          )}

          {/* 「나머지는 나중에 알려드릴게요」로 끝내지 않고 «확인할 자리»를 준다. */}
          <button
            type="button"
            onClick={() => navigate(MY_REPORTS_PATH)}
            style={{
              background: 'none', border: 'none', padding: '12px 0 0', cursor: 'pointer',
              fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'underline',
            }}
          >{CONTRIBUTIONS_TITLE} 보기</button>
        </div>
      )
    }

    return (
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
            {/* ★★ 사진이 바뀌면 «반드시» 읽어본 결과를 버린다(discardAnalysis).
                안 버리면 앞 사진의 토큰으로 저장돼 화면과 «다른 제품»이 DB 에 들어간다. */}
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={(e) => { setLabelImage(e.target.files?.[0] ?? null); discardAnalysis() }} />
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
              onChange={(e) => { setNutritionImage(e.target.files?.[0] ?? null); discardAnalysis() }} />
          </label>
        </div>

        {/* ───── 2단계: 읽어본 결과 미리보기 + 제품명 확정 ─────
            ★ 이 블록이 세션64 의 본체다. 종전에는 여기가 «없어서» 사진만 있으면
              바로 저장됐고, 이름을 모르는 서버가 첫 원재료명(「정제수」)을 제품명으로 넣었다.
              화면은 「제품명 미인식」이라 말하는데 DB 에는 「정제수」가 들어갔다. */}
        {analysis && nameSeed && (
          <div style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>사진에서 읽어낸 내용</div>

            <label htmlFor="report-product-name" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              제품명 <span style={{ color: '#ef4444' }}>(필수)</span>
            </label>
            <input
              id="report-product-name"
              type="text"
              value={productName}
              placeholder="예) 신라면 봉지면"
              autoComplete="off"
              onChange={(e) => { setProductName(e.target.value); setReportError(null) }}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8,
                border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text)',
              }}
            />
            {/* ⚠ 「미인식」이라고만 하고 끝내지 않는다. 사용자는 그게 «자기가 할 일»인 줄 모른다.
                실측상 라벨의 40.3% 는 제품명이 인쇄돼 있지도 않다 — 상시 경로다.
                ★ 등록된 제품이면 여기 문구가 「이미 등록된 제품명이에요」로 갈린다
                  (판정은 photoReport.ts:seedProductNameForExisting). */}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              {nameSeed.notice}
            </p>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
              {describeReadback(analysis)}
              {analysis.nutritionCount === 0 && ' — 영양성분표가 흐릿하면 다시 찍어 주시면 더 정확해져요.'}
            </p>
            <AllergenCard result={analysis} />
          </div>
        )}

        {reportError && (
          <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{reportError}</p>
        )}

        {/* ★★★ 흐름 «도중»의 401. 폼이 열린 뒤 세션이 끊긴 경우다.
            ⚠ 여기서 자동으로 로그인 화면으로 «옮기지 않는다» — 옮기는 순간 방금 고른 사진이
              말없이 사라진다. 사실을 먼저 말하고, 이동은 사용자가 «누를» 때만 한다. */}
        {authBlocked && (
          <div data-testid="report-auth-blocked" style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              {AUTH_PHOTO_LOST_NOTICE}
            </p>
            <button
              type="button" className="btn btn-primary"
              style={{ width: 'auto', padding: '9px 15px' }}
              onClick={() => goLoginForReport('report_auth_expired')}
            >{AUTH_RELOGIN_CTA}</button>
          </div>
        )}

        {/* 왜 못 보내는지를 «누르기 전에» 말한다. 버튼만 막고 침묵하면 고장 난 줄 안다. */}
        {analysis && !submitGate.ok && submitGate.reason && !reportError && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>{submitGate.reason}</p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {!analysis ? (
            <button
              type="button" className="btn btn-primary" style={{ flex: 1 }}
              disabled={reportBusy !== null || (!labelImage && !nutritionImage)}
              onClick={analyzePhotos}
            >{reportBusy === 'analyze' ? '읽는 중…' : '읽어보기'}</button>
          ) : (
            <button
              type="button" className="btn btn-primary" style={{ flex: 1 }}
              disabled={!submitGate.ok}
              onClick={confirmReport}
            >{reportBusy === 'confirm' ? '보내는 중…' : '보내기'}</button>
          )}
          <button
            type="button" className="btn btn-secondary"
            disabled={reportBusy !== null}
            onClick={() => {
              setReportOpen(false); setLabelImage(null); setNutritionImage(null)
              setAnalysis(null); setProductName(''); setReportError(null)
            }}
          >취소</button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
          {analysis
            ? '제품명을 확인하고 「보내기」를 눌러 주세요. 사진을 다시 고르면 처음부터 다시 읽어요.'
            : '한 장만 보내도 되지만, 두 장을 다 보내면 알레르기·영양을 훨씬 정확하게 읽어요. (사진당 10MB 이하) 「읽어보기」를 눌러도 아직 저장되지 않아요.'}
        </p>
      </div>
    )
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
        {/* ★ 세션64c — 「내가 보낸 제보」 진입점. 눈에 띄지 않게 둔다(주 동선은 스캔이다).
            ⚠ 비로그인이어도 «보인다». 그 화면이 로그인 필요를 스스로 말하는 편이,
              여기서 링크를 숨겨 「그런 게 있는 줄도 모르게」 만드는 것보다 낫다. */}
        <button
          type="button"
          onClick={() => navigate(MY_REPORTS_PATH)}
          style={{
            background: 'none', border: 'none', padding: '12px 0 0', cursor: 'pointer',
            fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'underline',
            display: 'block', margin: '0 auto',
          }}
        >{CONTRIBUTIONS_TITLE}</button>
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
            {/* ⚠ 2026-08-21 — 여기는 「**제품 앞면**과 …」이라고 말했지만 앞면 슬롯이 «없었다».
                안내문이 실제 입력과 어긋나 있었다. 실제로 받는 두 장에 맞춰 고친다.
                (앞면 슬롯을 새로 만들라는 뜻이 아니다 — 문구를 사실에 맞춘 것이다.) */}
            바코드 <strong>{notFound}</strong> 는 아직 데이터베이스에 없어요. 원재료·알레르기 표기와 영양성분표를 찍어 보내주시면
            검토 후 등록해 드릴게요. (등록되면 알려드릴게요.)
          </p>
          {!reportOpen && !confirmed ? (
            <>
              <button
                type="button" className="btn btn-secondary"
                onClick={() => openReportForm('not_found')}
              >이 제품 제보하기</button>
              {/* 로그인 게이트는 제보 버튼 «자리»에 뜬다. 사진 입력은 아직 열지 않는다. */}
              {loginGateOpen && renderLoginGate()}
            </>
          ) : renderReportForm('new')}
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

          {/* 첨가물 — ★★ 2026-08-23 외부검토: **4색 등급 표시를 껐다.**
              끈 방법은 `domain/meokseon/additives.ts` 의 `SHOW_RISK_GRADE` 하나다.
              그 상수를 true 로 되돌리면 아래 4색 안내문·pill 이 그대로 살아난다(코드는 남아 있다).
              근거: 초록 327종 중 314종(96%)이 계산이 아니라 자동 규칙으로 «찍힌» 값,
                    iarc_group 98.6% 결측, 라벨 첨가물의 33.3% 가 마스터 미매칭으로 소실. */}
          {additiveView && (
            <div className="survey-card" style={{ marginBottom: 16 }}>
              <h3 className="survey-step-title" style={{ fontSize: 16 }}>
                {/* ⚠ 「첨가물 7종」은 사실보다 강한 주장이다(33.3% 미매칭). 문구 정본은 additives.ts. */}
                {SHOW_RISK_GRADE ? `첨가물 ${additiveView.total}종` : describeAdditiveCount(additiveView.total)}
              </h3>
              {additiveView.total === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>등록된 첨가물 정보가 없어요.</p>
              ) : (
                <>
                  {SHOW_RISK_GRADE ? (
                    <>
                      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 12px', lineHeight: 1.6 }}>
                        첨가물 안전성을 4색으로 나타내요 (먹선 위해성 평가 기준).{' '}
                        <strong style={{ color: COLOR_HEX.green }}>초록 안전</strong> → 노랑 허용 → 주황 주의 → <strong style={{ color: COLOR_HEX.red }}>빨강 위해</strong>.
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {/* ★ 개수는 서버 `by_color` 가 아니라 «우리가 직접 센» 값이다.
                            서버 집계는 4색만 세므로 등급 미상이 어느 칸에도 안 잡힌다. */}
                        {PILL_COLORS.map((c) => {
                          const n = additiveView.counts[c]
                          return (
                            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 11px', borderRadius: 999, background: n ? `${COLOR_HEX[c]}1a` : 'var(--border-light)', color: n ? 'var(--text)' : 'var(--text-muted)' }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_HEX[c] }} />
                              {COLOR_LABEL[c]} <strong>{n}</strong>
                            </span>
                          )
                        })}
                        {/* 등급 미상은 0 이면 아예 띄우지 않는다(평소엔 소음). 있으면 «반드시» 띄운다. */}
                        {additiveView.counts.unknown > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 11px', borderRadius: 999, background: `${COLOR_HEX.unknown}1a`, color: 'var(--text)' }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_HEX.unknown }} />
                            {COLOR_LABEL.unknown} <strong>{additiveView.counts.unknown}</strong>
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    /* ★ 섹션 헤더에 «한 번만». 행마다 붙이면 그 자체가 경고가 된다.
                       ⚠ 「이 앱을 믿지 마세요」로 읽히면 실패다 — 어디까지 사실을 말할 수 있고
                          어디부터 아직 판단하지 않는지 «경계»를 보여주는 문장이다. */
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 12px', lineHeight: 1.6 }}>
                      {GRADE_HIDDEN_NOTICE}
                    </p>
                  )}
                  <AdditiveList view={additiveView} />
                </>
              )}
            </div>
          )}

          {/* ★ 2026-08-23 — 객체의 «존재»가 아니라 «값이 하나라도 있는가»로 그린다.
              종전 조건(`result.nutrition &&`)은 값이 전부 null 인 객체에도 카드를 그렸고,
              각 줄은 숫자가 아니면 건너뛰므로 **머리글만 있는 빈 표**가 남았다.
              그 상태에서 아래 「영양정보가 아직 없어요」까지 뜨면 화면이 스스로 모순된다.
              판정은 domain/meokseon/productCompleteness.ts (⚠ 0mg 은 «있음»이다). */}
          {result.nutrition && completeness?.nutrition.state === 'present' && (
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

          {/* ━━ ★★★★ 2026-08-23 세션64 외부검토 §B — 「이미 등록된 제품」에 정보를 보태는 경로 ━━
              종전에는 제보 UI 가 `notFound`(= DB 에 없는 바코드)일 때만 떴다.
              ⇒ 영양정보가 빈 채로 한 번 등록되면 그 제품은 「있음」이 되어 **제보 화면이 다시 안 뜬다.**
                사용자가 고칠 경로가 구조적으로 없었다.
                (검토자 표현: 「낮은 품질의 첫 제보가 미래의 고품질 제보를 차단한다.」)
              ⚠ 새 플로우를 만들지 않았다 — `renderReportForm` 은 미등록 경로와 «같은 함수»다.
              ⚠ 결손 판정은 여기서 하지 않는다. domain/meokseon/productCompleteness.ts 의 순수 함수다. */}
          {completeness && (completeness.gaps.length > 0 || reportOpen || confirmed) && (
            <div className="survey-card" style={{ marginBottom: 16 }}>
              {reportOpen || confirmed ? (
                <>
                  <h3 className="survey-step-title" style={{ fontSize: 16 }}>이 제품 정보 보태기</h3>
                  {renderReportForm('existing')}
                </>
              ) : (
                <>
                  <h3 className="survey-step-title" style={{ fontSize: 16 }}>
                    {completeness.gaps.length === 1
                      ? completeness.gaps[0].headline
                      : '아직 채워지지 않은 정보가 있어요'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                    {GAP_HELP_TEXT}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {completeness.gaps.map((g) => (
                      <button
                        key={g.kind} type="button" className="btn btn-primary"
                        style={{ width: 'auto', padding: '10px 16px' }}
                        onClick={() => {
                          // ⚠ 새 이벤트 이름을 만들지 않는다 — `ALL_APP_EVENTS` 는 DB CHECK 와 1:1 이다.
                          //   `source` 는 화이트리스트에 있는 기존 키다(events_core.ts).
                          // ★ 세션64c — 폼을 바로 열지 않는다. 로그인 게이트를 먼저 지난다.
                          openReportForm(`gap_${g.kind}`)
                        }}
                      >{g.cta}</button>
                    ))}
                  </div>
                  {loginGateOpen && renderLoginGate()}
                </>
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

          {/* ★ 결손이 «없을» 때의 보탬 경로 — **눈에 띄지 않아야 한다.**
              멀쩡한 제품에 카드·버튼을 크게 띄우면 「이 제품에 문제가 있다」로 읽힌다.
              그래도 경로 자체는 있어야 한다: 우리가 아는 결손이 없다는 것이
              「정보가 정확하다」는 뜻은 아니기 때문이다(잘못된 값은 결손이 아니다). */}
          {completeness && completeness.complete && !reportOpen && !confirmed && (
            <>
              <button
                type="button"
                onClick={() => openReportForm('gap_none')}
                style={{
                  background: 'none', border: 'none', padding: '10px 0 0', cursor: 'pointer',
                  fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'underline',
                  display: 'block', margin: '0 auto',
                }}
              >{completeness.fallbackCta}</button>
              {loginGateOpen && renderLoginGate()}
            </>
          )}
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
