-- =====================================================================
-- 166 · 탈퇴 삭제권 보완 — delete_user_data 에 오케스트레이터 3테이블 추가 + 안전 프로필 철회 함수 권한 축소
-- 웹앱트랙 2026-10-13 · 근거 IP/integration/delete_audit_v2.md (00_inspect 결과 delete_audit_result_20261013.csv)
--
-- 왜:
--  (1) action_candidates · orchestrator_decisions · action_events 의 user_id 는 auth.users FK 가 없고
--      delete_user_data 도 지우지 않음 → 탈퇴 후 잔존(현재 0행, 기능 가동 시 발생).
--      FK CASCADE 는 불가: Vita50 bench-orchestrator 가 auth.users 에 없는 합성 사용자
--      00000000-0000-0000-0000-0000000b0b0b 로 insert → FK 를 걸면 벤치가 깨짐. 그래서 RPC 에 명시 삭제.
--      순서 = 자식→부모: action_events(→decisions·candidates) → orchestrator_decisions(→candidates) → action_candidates.
--  (2) revoke_safety_profile_consent() 에 PUBLIC·anon EXECUTE 가 붙어 있음(생성 시 기본 권한).
--      본문이 where user_id = auth.uid() 라 anon 호출 시 변경 0 이지만, 다른 철회 함수와 같이 authenticated 만.
--
-- 본문: 10-13 운영 라이브 본문(IP/integration/delete_audit_v2/live_delete_user_data_20261013.sql)
--       그대로 + 오케스트레이터 블록·반환 키 3개만 추가. (IP/99 저장본은 meal_consent 가 빠진 옛본 — 쓰지 말 것)
-- 성격: CREATE OR REPLACE + REVOKE (멱등, 데이터 변경 0). 한 트랜잭션.
-- 실행: Supabase SQL Editor 에 통째로 Run → 맨 아래 확인 쿼리 결과를 CSV 로 저장.
-- =====================================================================
begin;

create or replace function public.delete_user_data(p_uid uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  d_biomarker int := 0; d_checkup int := 0; d_survey int := 0; d_profile int := 0; d_scan int := 0;
  d_meal_adj int := 0; d_job int := 0; d_meal int := 0; d_session int := 0;
  d_weekly int := 0; d_consent int := 0;
  d_act_evt int := 0; d_act_dec int := 0; d_act_cand int := 0;
begin
  -- ── 기존(검진·설문·먹선·프로필) ──
  delete from public.biomarker_values bv
    where bv.checkup_record_id in (select id from public.checkup_records where user_id = p_uid);
  get diagnostics d_biomarker = row_count;

  delete from public.checkup_records where user_id = p_uid;
  get diagnostics d_checkup = row_count;

  delete from public.survey_responses where user_id = p_uid;
  get diagnostics d_survey = row_count;

  if to_regclass('public.scan_history') is not null then
    delete from public.scan_history where user_id = p_uid;
    get diagnostics d_scan = row_count;
  end if;

  -- ── meal 스택 (자식 → 부모) ──
  if to_regclass('public.meal_log_adjustment') is not null then
    delete from public.meal_log_adjustment where user_id = p_uid;
    get diagnostics d_meal_adj = row_count;
  end if;

  if to_regclass('public.analysis_job') is not null then
    delete from public.analysis_job where user_id = p_uid;
    get diagnostics d_job = row_count;
  end if;

  if to_regclass('public.meal_log') is not null then
    delete from public.meal_log where user_id = p_uid;
    get diagnostics d_meal = row_count;
  end if;

  if to_regclass('public.meal_session') is not null then
    delete from public.meal_session where user_id = p_uid;
    get diagnostics d_session = row_count;
  end if;

  -- ── ★신규: 파생/개인화 통계 + 동의기록 ──
  if to_regclass('public.weekly_report') is not null then
    delete from public.weekly_report where user_id = p_uid;
    get diagnostics d_weekly = row_count;
  end if;

  if to_regclass('public.meal_consent') is not null then
    delete from public.meal_consent where user_id = p_uid;
    get diagnostics d_consent = row_count;
  end if;

  -- ── 166: 오케스트레이터(auth.users FK 없음 — 벤치 합성 사용자 때문) · 자식 → 부모 ──
  if to_regclass('public.action_events') is not null then
    delete from public.action_events where user_id = p_uid;
    get diagnostics d_act_evt = row_count;
  end if;

  if to_regclass('public.orchestrator_decisions') is not null then
    delete from public.orchestrator_decisions where user_id = p_uid;
    get diagnostics d_act_dec = row_count;
  end if;

  if to_regclass('public.action_candidates') is not null then
    delete from public.action_candidates where user_id = p_uid;
    get diagnostics d_act_cand = row_count;
  end if;

  -- ── 프로필(마지막) ──
  delete from public.profiles where id = p_uid;   -- 라이브 profiles PK=id
  get diagnostics d_profile = row_count;

  return jsonb_build_object(
    'biomarker_values',    d_biomarker,
    'checkup_records',     d_checkup,
    'survey_responses',    d_survey,
    'scan_history',        d_scan,
    'meal_log_adjustment', d_meal_adj,
    'analysis_job',        d_job,
    'meal_log',            d_meal,
    'meal_session',        d_session,
    'weekly_report',       d_weekly,
    'meal_consent',        d_consent,
    'action_events',          d_act_evt,
    'orchestrator_decisions', d_act_dec,
    'action_candidates',      d_act_cand,
    'profiles',            d_profile
  );
end;
$function$;

-- 실행 권한: service_role(Edge account-delete)만 — 기존과 동일하게 재확인
revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_data(uuid) to service_role;

-- (2) 안전 프로필 철회: authenticated 만
revoke all on function public.revoke_safety_profile_consent() from public, anon;
grant execute on function public.revoke_safety_profile_consent() to authenticated;

commit;

-- ── 확인(결과 1표 → CSV 저장: 166_apply_result_20261013.csv) ──
select 'acl' as k, p.oid::regprocedure::text as obj, coalesce(p.proacl::text, '(default)') as v
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('delete_user_data', 'revoke_safety_profile_consent')
union all
select 'body_has', t, (position(t in pg_get_functiondef('public.delete_user_data(uuid)'::regprocedure)) > 0)::text
from unnest(array['meal_consent', 'action_events', 'orchestrator_decisions', 'action_candidates', 'weekly_report']) t
union all
-- 존재하지 않는 uid → 전 필드 0, 키 14개 (트랜잭션 안에서 실행 후 되돌릴 필요 없음 — 0행 대상)
select 'smoke_nonexistent_uid', 'keys=' || (select count(*) from jsonb_object_keys(r))::text, r::text
from (select public.delete_user_data('00000000-0000-0000-0000-000000000000'::uuid) as r) s
order by 1, 2;
