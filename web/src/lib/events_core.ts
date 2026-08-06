/**
 * 익명 계측 — 순수 코어(supabase 비의존, 테스트 대상).
 * AppEvent 유니온 · surface 도출 · props 화이트리스트 sanitize.
 * DB 정합: app_event_event_enum / app_event_props_keys 제약과 1:1 유지.
 *   정본 마이그레이션: supabase/149_app_event_enum_sync_v1.sql
 *   ★ 「유지한다」는 주석이 아니라 **테스트가 강제한다** — src/lib/__tests__/events_db_sync.test.ts
 *     (2026-08-06 이전에는 주석만 있었고 실제로는 TS 27 vs DB 13 으로 갈라져 있었다)
 */

/**
 * 퍼널 이벤트 이름 — DB `app_event_event_enum` CHECK 제약과 «같은 집합»이어야 한다.
 *
 * ★ 타입이 아니라 «런타임 배열»이 정본이다(2026-08-06 변경).
 *   종전에는 `export type AppEvent = 'a' | 'b' | …` 유니온이라 런타임에 목록이 사라져
 *   DB 제약과 대조할 방법이 없었고, 실제로 **TS 27 vs DB 13 으로 갈라져 있었다.**
 *   초과분은 CHECK 에 걸려 INSERT 가 조용히 거부됐고 `track` 이 실패를 삼켜 아무도 몰랐다.
 *   배열로 두면 `events_db_sync.test.ts` 가 마이그레이션 SQL 과 직접 대조할 수 있다.
 *
 * 추가할 때: 이 배열 + `supabase/149_app_event_enum_sync_v1.sql` 을 «함께» 고칠 것.
 *   한쪽만 고치면 위 테스트가 빨갛게 잡는다.
 */
export const ALL_APP_EVENTS = [
  // ── scan(먹선 제품 스캔) 퍼널 ──
  'scan_page_view',
  'scan_camera_start',
  'scan_camera_unsupported',
  'scan_barcode_detected',
  'scan_search_submit',
  'scan_lookup_success',
  'scan_lookup_not_found',
  'scan_lookup_error',
  'scan_personalize_shown',
  'scan_survey_cta_click',
  'scan_report_click',
  'scan_report_submit',      // 사진 제보를 «서버가 받았다»(2026-08-06). saved 로 저장 여부 구분
  'scan_report_error',       // 사진 제보 실패 — 이 값이 0 이 아니면 업로드 경로를 봐야 한다
  'scan_share_click',
  'scan_saved',
  'scan_promote',            // 비로그인 로컬 스캔 → 서버 승격 결과(IP/146)
  'scan_login_cta_click',    // '이 기기에만 저장' 배너의 로그인 CTA(IP/146)
  // ── meal(NutriLens 식사기록) 퍼널 ──
  'meal_page_view',          // 식사 기록 페이지 진입
  'meal_consent_shown',      // 촬영 전 동의 게이트 노출
  'meal_consent_accepted',   // 동의 완료(촬영 진입)
  'meal_capture_start',      // 촬영/업로드 시작
  'meal_analyze_success',    // 사진 분석 성공
  'meal_analyze_error',      // 사진 분석 실패
  'meal_saved',              // 식사 기록 저장
  'meal_session_start',      // 정찬 세션 시작
  'meal_session_close',      // 정찬 세션 종료
  'meal_leftover_open',      // '먹은 양' 패널 열기
  'meal_leftover_apply',     // 잔반 보정 적용
  // ── report(주간 리포트) ──
  'weekly_report_view',      // 주간 리포트 열람
] as const

export type AppEvent = typeof ALL_APP_EVENTS[number]

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
  // scan 사진 제보(2026-08-06)
  'saved',            // boolean: 서버가 크라우드 기여로 «저장»까지 했는가(분석만 된 것과 구분)
  'nutrition_count',  // number: 사진에서 읽힌 영양소 개수(0 이면 재촬영 유도가 필요하다)
])

/* ⚠ 2026-08-06 실측 — 이 목록과 DB 제약이 «1:1 이 아니었다».
 *   위 주석은 「DB app_event_props_keys와 동일」이라고 적고 있었지만 실제로는
 *   TS 15 vs DB 9, 이벤트는 TS 27 vs DB 13 이었다. 초과분은 CHECK 제약에 걸려
 *   **INSERT 가 조용히 거부**됐다. `track` 은 fire-and-forget 이라 아무도 몰랐고,
 *   그래서 NutriLens 식사기록 퍼널 11개가 «수집되지 않은 채» 지표로 쓰이고 있었다.
 *   → `supabase/149_app_event_enum_sync_v1.sql` 이 두 제약을 이 파일 기준으로 다시 만든다.
 *   → `src/lib/__tests__/events_db_sync.test.ts` 가 앞으로의 드리프트를 막는다.
 *
 * ⚠ 아직 화이트리스트에 «없는» 키 (코드는 넘기지만 sanitize 가 버린다) — 제이 판단 필요:
 *     status · attempted · promoted · at · local_n   (scan_promote 계열)
 *   개인정보 유입 경로가 될 수 있어 임의로 추가하지 않았다. 의도한 지표라면 함께 등록할 것.
 */

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
