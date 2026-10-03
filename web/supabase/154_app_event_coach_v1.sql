-- ============================================================================
-- 154_app_event_coach_v1.sql — 코칭 카드 노출 계측 이벤트 2종 + props 2키
-- 2026-10-03 (웹앱트랙 건강관리 계열)
-- ============================================================================
-- 무엇을 더하나
--   이벤트: 'coach_card_shown'(카드 노출, 같은 브라우저·같은 날·같은 카드 1회)
--           'coach_why_open'  («왜 이 카드?» 펼침)
--   props : 'coach_card'(g_pro|g_veg|g_am|v1_protein) · 'coach_level'(normal|strong)
--   건강 수치·음식명·g 값은 «넣지 않는다». 평가 IP/integration/coach_card_telemetry_eval_v1.md
--
-- ⚠ 150 을 대체한다(전체 재동기화 형태). 149·150 을 다시 돌릴 필요는 없다.
-- ⚠ 이 파일을 만들었다고 적용된 게 아니다. **Supabase SQL Editor 에 붙여넣어야 한다.**
--   events_db_sync 테스트는 «파일»만 본다 — 운영 DB 적용 여부는 못 본다.
--
-- 멱등: 여러 번 실행해도 안전하다(drop if exists → add).
-- 확인: select event, props, occurred_at from public.app_event where surface = 'coach'
--        order by occurred_at desc limit 20;
-- ============================================================================

-- 기존 제약 제거(멱등의 핵심 — 이 두 줄이 없으면 «already exists» 로 실패한다)
alter table public.app_event drop constraint if exists app_event_event_enum;
alter table public.app_event drop constraint if exists app_event_props_keys;

-- ── 이벤트 화이트리스트 (src/lib/events_core.ts 의 AppEvent 와 «글자까지» 같아야 한다) ──
--    검사: src/lib/__tests__/events_db_sync.test.ts 가 이 파일과 TS 를 대조한다.
alter table public.app_event add constraint app_event_event_enum check (event in (
  -- scan(먹선 제품 스캔) 퍼널
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
  'scan_report_submit',
  'scan_report_error',
  'scan_share_click',
  'scan_saved',
  'scan_promote',
  'scan_login_cta_click',
  -- meal(NutriLens 식사기록) 퍼널
  'meal_page_view',
  'meal_consent_shown',
  'meal_consent_accepted',
  'meal_capture_start',
  'meal_analyze_success',
  'meal_analyze_error',
  'meal_saved',
  'meal_session_start',
  'meal_session_close',
  'meal_leftover_open',
  'meal_leftover_apply',
  -- report(주간 리포트)
  'weekly_report_view',
  -- meal 정정(2026-09-03 세션52)
  'meal_food_corrected',
  -- 코칭 카드 노출 계측(154 · 2026-10-03)
  'coach_card_shown',
  'coach_why_open'
));

-- ── props 키 화이트리스트 (전부 카운트·enum·boolean. 자유 텍스트·건강값·식별자 없음) ──
--    나열 키를 제거한 결과가 빈 객체여야 통과 = 허용 키만 존재.
alter table public.app_event add constraint app_event_props_keys check (
  props is null or (
    props - array[
      -- scan 계열
      'source', 'has_nutrition', 'has_additives', 'result_count',
      'applicable', 'flag_count', 'food_category', 'error_kind', 'saved_to',
      -- scan 사진 제보(2026-08-06)
      'saved', 'nutrition_count',
      -- meal / report 계열
      'food_count', 'plate_count', 'mode', 'method', 'cached', 'has_data',
      -- coach 계열(154) — enum 문자열만: coach_card ∈ g_pro|g_veg|g_am|v1_protein · coach_level ∈ normal|strong
      'coach_card', 'coach_level'
    ]::text[]
  ) = '{}'::jsonb
);

-- ⚠ 아직 «등록하지 않은» 키 — 코드는 넘기지만 클라이언트 sanitize 가 버린다.
--   status · attempted · promoted · at · local_n  (scan_promote 계열)
--   개인정보 유입 경로가 될 수 있어 임의로 열지 않았다. 지표로 쓸 것이면
--   events_core.ts 의 ALLOWED_PROP_KEYS 와 위 배열에 «함께» 추가할 것.
