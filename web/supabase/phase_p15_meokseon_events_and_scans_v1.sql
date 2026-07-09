-- =============================================================================
-- phase_p15_meokseon_events_and_scans_v1.sql
-- 먹선 P1.5 후킹: (A) 익명 계측 sink app_event, (B) 사용자 스캔 이력 scan_history.
--
-- 설계 근거: 인수인계 62(계측)·65(sink 결정). 기존 방어선과 동일 패턴:
--   - survey_responses/anon_sessions 의 RLS(본인 행 한정)
--   - get_insights() 의 어드민 전용 집계 + k-익명성(작업지시서 58)
-- 컴플라이언스: app_event 는 개인 식별자(user_id/영속 세션)를 담지 않는 "익명/집계" sink.
--   scan_history 는 "본인 소유" 데이터로 RLS·soft-delete·계정삭제 cascade 로 삭제권 보장.
-- 멱등: 반복 실행 안전(create if not exists / drop policy if exists).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (A) app_event — 익명 퍼널 계측 sink (INSERT-only, 개인정보 없음)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_event (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  event        text        not null,        -- 예: 'scan_page_view' … 'scan_survey_cta_click'
  surface      text,                        -- 예: 'scan'
  visit_id     text,                        -- 방문 단위 상관용(클라 메모리 전용, 교차세션 추적 아님)
  props        jsonb,                        -- 비개인정보만(화이트리스트: source/has_*/result_count/flag_count/food_category/error_kind/saved_to)
  app_version  text
);

create index if not exists app_event_occurred_idx on public.app_event (occurred_at);
create index if not exists app_event_event_idx    on public.app_event (event);

-- [DB-level 강제] 클라 화이트리스트만 믿지 않는다(anon insert 변조 방어). 멱등(제약 없을 때만 추가).
--   - event: 허용 이벤트명 enum만
--   - props: 화이트리스트 키만(barcode/product_name/user_id/email/image/raw OCR 등 유입 원천 차단)
--   - props/visit_id/surface: 크기·길이 상한(spam·오염 방어)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_event_event_enum') then
    alter table public.app_event add constraint app_event_event_enum check (event in (
      'scan_page_view','scan_camera_start','scan_camera_unsupported','scan_barcode_detected',
      'scan_search_submit','scan_lookup_success','scan_lookup_not_found','scan_lookup_error',
      'scan_personalize_shown','scan_survey_cta_click','scan_report_click','scan_share_click','scan_saved'
    ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_event_visit_len') then
    alter table public.app_event add constraint app_event_visit_len
      check (visit_id is null or char_length(visit_id) <= 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_event_surface_len') then
    alter table public.app_event add constraint app_event_surface_len
      check (surface is null or char_length(surface) <= 32);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_event_props_size') then
    alter table public.app_event add constraint app_event_props_size
      check (props is null or pg_column_size(props) <= 2048);
  end if;
  -- props 키 화이트리스트: 나열 키를 제거한 결과가 빈 객체여야 통과(= 허용 키만 존재).
  if not exists (select 1 from pg_constraint where conname = 'app_event_props_keys') then
    alter table public.app_event add constraint app_event_props_keys check (
      props is null or (
        props - array['source','has_nutrition','has_additives','result_count',
                      'applicable','flag_count','food_category','error_kind','saved_to']::text[]
      ) = '{}'::jsonb
    );
  end if;
end $$;

alter table public.app_event enable row level security;

-- 익명·인증 role 모두 INSERT만 허용. SELECT/UPDATE/DELETE 정책 없음 → 공개(anon) 키로 조회 불가.
-- 값 검증은 위 CHECK 제약이 권위. 집계 조회는 아래 (C) 어드민 RPC 로만.
drop policy if exists app_event_insert on public.app_event;
create policy app_event_insert on public.app_event
  for insert to anon, authenticated
  with check (event is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- (B) scan_history — 사용자 본인 스캔 이력(리텐션 B축). RLS 본인 행 한정 + HARD DELETE.
--     [PIPA] 개별 삭제 = 물리 삭제(즉시 영구 파기). soft-delete 미사용 → 별도 파기 크론 불필요.
--            "개별 삭제 시 즉시 영구 삭제"가 법적으로 참이 되도록 설계(리뷰 반영).
--            (백업/PITR 보관분은 보관기간 경과 후 파기 — 처리방침에 별도 명시.)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.scan_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  scanned_at    timestamptz not null default now(),
  barcode       text,
  product_name  text,
  brand         text,
  food_category text,
  image_url     text,
  nutrition     jsonb,                       -- 먹선 조회 영양 스냅샷(제품 팩트, 개인정보 아님)
  additives     jsonb                        -- {total, green, yellow, orange, red}
  -- [프라이버시] 설문 파생 개인화(주의 영양소)는 저장하지 않는다(건강상태 추론 파생정보 방지).
  --   "내 기준으로 보기"는 조회 시점에 재계산. 스캔 이력 = 제품 팩트만.
);

create index if not exists scan_history_user_idx on public.scan_history (user_id, scanned_at desc);

alter table public.scan_history enable row level security;

drop policy if exists scan_history_select on public.scan_history;
create policy scan_history_select on public.scan_history
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists scan_history_insert on public.scan_history;
create policy scan_history_insert on public.scan_history
  for insert to authenticated
  with check (user_id = auth.uid());

-- 개별 삭제 = 물리 DELETE(본인 행만). soft-delete update 정책은 두지 않는다.
drop policy if exists scan_history_update on public.scan_history;
drop policy if exists scan_history_delete on public.scan_history;
create policy scan_history_delete on public.scan_history
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- (C) 어드민 집계 RPC — 익명 퍼널 지표(k-익명성). get_insights() 와 동일 방어선.
--     어드민 가드: 기본은 어드민 이메일(JWT claim) 기반 — 편집 없이 바로 동작.
--     ※ 기존 get_insights() 가 admin 허용목록 테이블 등 다른 방식이면, 아래 IF 조건 한 줄만
--       그 방식으로 바꿔 일치시키면 됨(예: not exists (select 1 from public.admin_users where user_id = auth.uid())).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_scan_metrics(days integer default 30, k_min integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  since  timestamptz := now() - make_interval(days => greatest(1, days));
begin
  -- 어드민 전용(비어드민 호출 차단). 어드민 이메일은 필요 시 아래 배열에 추가.
  if coalesce(auth.jwt() ->> 'email', '') <> all (array['saeronjhk@gmail.com']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'window_days',  days,
    'k_min',        k_min,
    -- 이벤트별 건수(퍼널)
    'by_event', coalesce((
      select jsonb_object_agg(event, c)
      from (
        select event, count(*)::int as c
        from public.app_event
        where occurred_at >= since
        group by event
      ) e
    ), '{}'::jsonb),
    -- 방문(visit_id) 기준 퍼널 근사: 페이지뷰 대비 성공/전환
    'visits',            (select count(distinct visit_id)::int from public.app_event where occurred_at >= since and event = 'scan_page_view'),
    'lookup_success',    (select count(*)::int from public.app_event where occurred_at >= since and event = 'scan_lookup_success'),
    'lookup_not_found',  (select count(*)::int from public.app_event where occurred_at >= since and event = 'scan_lookup_not_found'),
    'survey_cta_clicks', (select count(*)::int from public.app_event where occurred_at >= since and event = 'scan_survey_cta_click'),
    -- 카테고리 상위(k-익명: k_min 미만 셀 억제)
    'top_categories', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc)
      from (
        select props->>'food_category' as name, count(*)::int as n
        from public.app_event
        where occurred_at >= since and event = 'scan_lookup_success' and props ? 'food_category'
        group by props->>'food_category'
        having count(*) >= k_min
        limit 12
      ) c
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_scan_metrics(integer, integer) from public, anon;
grant execute on function public.get_scan_metrics(integer, integer) to authenticated;  -- 함수 내부 어드민 가드가 비어드민 차단

-- =============================================================================
-- 계정 삭제 연동 주의(인수인계 63 account-delete):
--   scan_history 는 user_id FK on delete cascade → account-delete Edge Function 이
--   auth.users 행을 실제 삭제하면 물리적으로 함께 파기됨(soft-delete 없음 → 잔존 없음).
--   ⚠️ Edge Function 이 테이블 나열식 삭제/0행 검증이면 scan_history 도 목록에 추가할 것.
--   app_event 는 user_id 가 없어(익명) 삭제 대상 아님(props DB CHECK 로 식별자 유입 차단됨).
-- =============================================================================
