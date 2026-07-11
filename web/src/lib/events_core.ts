/**
 * 익명 계측 — 순수 코어(supabase 비의존, 테스트 대상).
 * AppEvent 유니온 · surface 도출 · props 화이트리스트 sanitize.
 * DB 정합: app_event_event_enum / app_event_props_keys 제약과 1:1 유지(마이그레이션 IP 98).
 */

// 퍼널 이벤트 이름 — DB app_event_event_enum과 동일 집합 유지.
export type AppEvent =
  // ── scan(먹선 제품 스캔) 퍼널 ──
  | 'scan_page_view'
  | 'scan_camera_start'
  | 'scan_camera_unsupported'
  | 'scan_barcode_detected'
  | 'scan_search_submit'
  | 'scan_lookup_success'
  | 'scan_lookup_not_found'
  | 'scan_lookup_error'
  | 'scan_personalize_shown'
  | 'scan_survey_cta_click'
  | 'scan_report_click'
  | 'scan_share_click'
  | 'scan_saved'
  // ── meal(NutriLens 식사기록) 퍼널 ──
  | 'meal_page_view'          // 식사 기록 페이지 진입
  | 'meal_consent_shown'      // 촬영 전 동의 게이트 노출
  | 'meal_consent_accepted'   // 동의 완료(촬영 진입)
  | 'meal_capture_start'      // 촬영/업로드 시작
  | 'meal_analyze_success'    // 사진 분석 성공
  | 'meal_analyze_error'      // 사진 분석 실패
  | 'meal_saved'              // 식사 기록 저장
  | 'meal_session_start'      // 정찬 세션 시작
  | 'meal_session_close'      // 정찬 세션 종료
  | 'meal_leftover_open'      // '먹은 양' 패널 열기
  | 'meal_leftover_apply'     // 잔반 보정 적용
  // ── report(주간 리포트) ──
  | 'weekly_report_view'      // 주간 리포트 열람

export type PropVal = string | number | boolean | null
export type Props = Record<string, PropVal>

// props 화이트리스트 — 여기 없는 키는 버린다(PII 유입 원천 차단). DB app_event_props_keys와 동일.
export const ALLOWED_PROP_KEYS = new Set<string>([
  // scan 계열
  'source', 'has_nutrition', 'has_additives', 'result_count',
  'applicable', 'flag_count', 'food_category', 'error_kind', 'saved_to',
  // meal / report 계열(전부 카운트·enum·boolean — 개인정보/건강값 없음)
  'food_count',   // number: 분석된 음식 수
  'plate_count',  // number: 정찬 접시 수
  'mode',         // 'all' | 'perfood' | 'photo': 먹은 양 패널 모드
  'method',       // 'slider' | 'photo_ai': 잔반 보정 방식
  'cached',       // boolean: 리포트 캐시 여부
  'has_data',     // boolean: 리포트 데이터 유무
])

/** 이벤트 접두 → surface 도출(sink 분류). scan_* / meal_* / weekly_report* */
export function surfaceOf(event: AppEvent): string {
  if (event.startsWith('meal_')) return 'meal'
  if (event.startsWith('weekly_report')) return 'report'
  return 'scan'
}

/** 화이트리스트 키만 통과. 없거나 비면 null. */
export function sanitize(props?: Props): Props | null {
  if (!props) return null
  const out: Props = {}
  for (const k of Object.keys(props)) {
    if (ALLOWED_PROP_KEYS.has(k)) out[k] = props[k]
  }
  return Object.keys(out).length ? out : null
}
