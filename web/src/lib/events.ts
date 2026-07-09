/**
 * 익명 제품 계측(먹선 P1.5 후킹 퍼널) — 컴플라이언스 안전 sink.
 *
 * 설계 원칙(작업지시서 62 계측 + 65 sink 결정):
 *  - [익명/집계] 영속 식별자를 만들지 않는다. visit_id는 페이지 로드마다 새로 생성되는
 *    "메모리 전용" 값으로, 한 방문 안의 퍼널(조회→결과→전환)을 잇는 용도로만 쓰이고
 *    저장·교차세션 추적에 쓰이지 않는다. user_id도 담지 않는다(제품 조회는 무인증·개인정보 무관).
 *  - [PII 차단] props는 화이트리스트 키만 통과(제품/결과/카운트 등 비개인정보). 자유 텍스트·설문값 불가.
 *  - [옵트아웃 존중] 사용자가 명시적으로 수집 거부(sf_data_consent=declined)한 경우 전송하지 않는다.
 *  - [UI 무영향] fire-and-forget. 실패·미마이그레이션 상태에서도 절대 throw하지 않는다.
 *    (app_event 테이블이 아직 없으면 insert가 조용히 실패할 뿐, 스캔 UX엔 영향 없음.)
 *
 * 적재 위치: 자체 Supabase app_event 테이블(RLS insert-only, 익명 role 허용).
 *   집계 조회는 어드민 SECURITY DEFINER RPC(k-익명성)로만 — get_insights()와 동일 방어선.
 *   스키마: supabase/phase_p15_meokseon_events_and_scans_v1.sql
 *
 * 주의: 이것은 "사용자 개인 데이터"가 아니라 익명 퍼널 카운트다. 사용자 본인에게 보여주는
 *   스캔 이력(리텐션)은 scanHistory.ts(본인 소유 데이터)로 분리되어 있다.
 */
import { supabase } from './supabase'
import { hasDeclinedCollection } from './analytics'

// 퍼널 이벤트 이름(문서 62 계측 계약과 1:1로 유지 — 이름 변경 시 이 유니온만 수정).
export type AppEvent =
  | 'scan_page_view'          // 스캔 페이지 진입
  | 'scan_camera_start'       // 카메라 스캔 시작
  | 'scan_camera_unsupported' // BarcodeDetector 미지원 → 이름검색 폴백
  | 'scan_barcode_detected'   // 바코드 인식 성공
  | 'scan_search_submit'      // 이름 검색 제출
  | 'scan_lookup_success'     // 제품 조회 성공(결과 표시)
  | 'scan_lookup_not_found'   // 미등록(404) — 콜드스타트
  | 'scan_lookup_error'       // 조회 오류
  | 'scan_personalize_shown'  // 개인화("내 기준으로 보기") 노출
  | 'scan_survey_cta_click'   // 블러 맛보기 → 설문 CTA 클릭(전환)
  | 'scan_report_click'       // 미등록 제품 제보 클릭
  | 'scan_share_click'        // 공유 클릭
  | 'scan_saved'              // 스캔 이력 저장(리텐션 축 진입)

type PropVal = string | number | boolean | null
type Props = Record<string, PropVal>

// props 화이트리스트 — 여기 없는 키는 버린다(PII 유입 원천 차단).
const ALLOWED_PROP_KEYS = new Set<string>([
  'source',        // 'barcode' | 'search'
  'has_nutrition', // boolean
  'has_additives', // boolean
  'result_count',  // number (검색 결과 수)
  'applicable',    // boolean (개인화 관련 질환/목표 존재)
  'flag_count',    // number (주의 항목 수)
  'food_category', // string (제품 카테고리 — 비개인정보)
  'error_kind',    // string ('network' 등)
  'saved_to',      // 'cloud' | 'local'
])

// 방문 단위 상관 id — 메모리 전용(저장 안 함, 교차세션 추적 아님).
function newVisitId(): string {
  return typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `v-${Math.random().toString(36).slice(2)}`
}
// mutable: 동의 철회 시 즉시 파기(리뷰 B) — 이후 퍼널 상관이 끊긴다.
let VISIT_ID: string = newVisitId()

/** 수집 동의 철회(declined) 즉시 호출 — visit_id를 파기해 퍼널 상관을 끊는다. */
export function clearTelemetryVisit(): void {
  VISIT_ID = ''
}

const APP_VERSION: string = (import.meta.env.VITE_APP_VERSION as string) || ''

function sanitize(props?: Props): Props | null {
  if (!props) return null
  const out: Props = {}
  for (const k of Object.keys(props)) {
    if (ALLOWED_PROP_KEYS.has(k)) out[k] = props[k]
  }
  return Object.keys(out).length ? out : null
}

/**
 * 익명 이벤트 1건 적재. 절대 await 하지 말 것(fire-and-forget). 실패는 무시.
 */
export function track(event: AppEvent, props?: Props): void {
  try {
    if (hasDeclinedCollection()) {
      // 명시적 수집 거부 — 전송 안 함 + visit_id 즉시 파기(상관 끊기, 리뷰 B)
      if (VISIT_ID) VISIT_ID = ''
      return
    }
    void supabase
      .from('app_event')
      .insert({
        event,
        surface: 'scan',
        visit_id: VISIT_ID || null,
        props: sanitize(props),
        app_version: APP_VERSION || null,
      })
      .then(({ error }) => {
        if (error) console.debug('[events] insert skipped:', error.message)
      })
  } catch {
    // 무시 — 계측은 절대 UX를 막지 않는다
  }
}
