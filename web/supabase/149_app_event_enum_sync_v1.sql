-- ============================================================================
-- 149_app_event_enum_sync_v1.sql — app_event CHECK 제약을 코드 기준으로 재동기화
-- 2026-08-06
-- ============================================================================
-- 왜 필요한가 (실측)
--   `src/lib/events_core.ts` 는 주석에 「DB app_event_event_enum / app_event_props_keys
--   제약과 1:1 유지」라고 적어 두었지만, 실제로는 어긋나 있었다:
--
--       이벤트   TS 27 종  vs  DB 13 종   → 14 종이 CHECK 에 걸려 INSERT 거부
--       props    TS 15 키  vs  DB  9 키   →  6 키가 CHECK 에 걸려 INSERT 거부
--
--   `track()` 은 fire-and-forget(실패를 삼킨다)이라 아무도 눈치채지 못했다.
--   그 결과 **NutriLens 식사기록 퍼널 11개 이벤트가 한 건도 적재되지 않은 채**
--   지표로 쓰이고 있었다. 거부된 목록:
--     scan_promote · scan_login_cta_click · weekly_report_view ·
--     meal_page_view · meal_consent_shown · meal_consent_accepted ·
--     meal_capture_start · meal_analyze_success · meal_analyze_error ·
--     meal_saved · meal_session_start · meal_session_close ·
--     meal_leftover_open · meal_leftover_apply
--   props: food_count · plate_count · mode · method · cached · has_data
--
--   ⚠ 이 마이그레이션은 **과거 데이터를 복구하지 않는다.** 거부된 이벤트는 애초에
--     저장되지 않았다. 오늘 이후분만 쌓인다. meal 퍼널 지표를 볼 때 이 날짜를 기준선으로 삼을 것.
--
-- 원본 제약: phase_p15_meokseon_events_and_scans_v1.sql:33-63
--   그 파일은 `if not exists` 로 감싸 두어서 **재실행해도 갱신되지 않는다.**
--   그래서 여기서는 drop 후 다시 만든다.
--
-- 멱등: 여러 번 실행해도 안전하다(drop if exists → add).
-- 실행: Supabase SQL Editor 에 그대로 붙여넣기.
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
  'weekly_report_view'
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
