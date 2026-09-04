-- ============================================================================
-- 150_app_event_meal_correction_v1.sql — meal_food_corrected 이벤트 추가
-- 2026-09-03 (세션52)
-- ============================================================================
-- 무엇을 더하나
--   'meal_food_corrected' 한 종. 사용자가 «구별 불가 쌍»(설렁탕↔곰탕 ·
--   꽃게탕↔해물탕)에서 이름을 직접 고쳐 잡을 때 찍는다.
--
-- ★ 왜 이 한 줄이 중요한가
--   IP/178 규칙47 이 계속 경고해 온 것 — 우리 정확도 수치는 전부 «in-domain 상한»이고
--   유저 폰 사진으로 잰 적이 없다. 이 이벤트는 그 벽을 넘는 첫 실측 창구다.
--   설렁탕/곰탕 자동 선택이 실제 사용자에게 얼마나 틀리는지를, 평가셋이 아니라
--   현장에서 세게 된다. (aihub300 에서는 정확히 2:2 동전던지기였다 — IP/179 §2)
--
-- props 는 새로 열지 않는다. 기존 허용 키 'source' 에 'indistinguishable_pair' 를 넣는다.
--   음식 이름은 «넣지 않는다» — ALLOWED_PROP_KEYS 가 food_name 을 막아 온 정책 그대로다.
--
-- ⚠ 149 를 대체한다(전체 재동기화 형태). 149 를 다시 돌릴 필요는 없다.
-- ⚠ 이 파일을 만들었다고 적용된 게 아니다. **Supabase SQL Editor 에 붙여넣어야 한다.**
--   events_db_sync 테스트는 «파일»만 본다 — 운영 DB 적용 여부는 못 본다.
--
-- 멱등: 여러 번 실행해도 안전하다(drop if exists → add).
-- ============================================================================

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
  'meal_food_corrected'
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
      'food_count', 'plate_count', 'mode', 'method', 'cached', 'has_data'
    ]::text[]
  ) = '{}'::jsonb
);

-- ⚠ 아직 «등록하지 않은» 키 — 코드는 넘기지만 클라이언트 sanitize 가 버린다.
--   status · attempted · promoted · at · local_n  (scan_promote 계열)
--   개인정보 유입 경로가 될 수 있어 임의로 열지 않았다. 지표로 쓸 것이면
--   events_core.ts 의 ALLOWED_PROP_KEYS 와 위 배열에 «함께» 추가할 것.
