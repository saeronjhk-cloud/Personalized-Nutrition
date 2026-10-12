-- =====================================================================
-- 163 · survey_consent — 설문 민감정보 동의 서버 기록 v2 (검진 161 방식 · 비로그인은 같은 행에 기록)
-- 평가: IP/integration/survey_consent_v2_eval_v1.md (D1~D16 · S01~S19)
-- 문구 정본: IP/설문동의_고지문안_정본_v1_20261012.md (notice_hash = §1 블록 sha256)
-- 제이 결정 10-12: J2 비로그인 = submit_anon_survey RPC 가 동의를 같은 행에 기록 · J3 기존 사용자 = 제이 1명(이관 없음)
-- 성격: 멱등 · 비파괴(설문 데이터 변화 0). ⚠️ 적용 즉시 «v2 동의 없는 로그인 이용자»는 설문·목표 조회/저장 불가(D4)
--       → 실행 직후 앱 push(규칙 85). 제이는 배포 후 /survey 에서 1회 동의(R1).
-- 적용: Supabase SQL Editor 에 전체 붙여 넣고 Run. 마지막 결과표(확인)를 CSV 로 첨부.
-- =====================================================================
begin;

-- ── D2 싱글턴 ──
create table if not exists public.survey_consent_policy (
  id                      boolean primary key default true,
  current_notice_version  text not null,
  current_policy_version  text not null,
  notice_hash             text,
  updated_at              timestamptz not null default now(),
  constraint survey_consent_policy_singleton check (id = true)
);
insert into public.survey_consent_policy(id, current_notice_version, current_policy_version, notice_hash)
values (true, 'survey_v1', '13_v5.2', '06d92309f9964a28f8ce36bd77e3a2bca7af8d7f9a47a9d7864736c82e676b14')
on conflict (id) do nothing;
alter table public.survey_consent_policy enable row level security;
revoke all on public.survey_consent_policy from authenticated, anon;

-- 처리방침 13_v5.2(경미 변경) — 검진 동의 기록용 policy_version 도 맞춤(재동의 없음, 규칙 78)
update public.checkup_consent_policy set current_policy_version = '13_v5.2', updated_at = now()
 where id = true and current_policy_version is distinct from '13_v5.2';

-- ── D1 동의 기록 ──
create table if not exists public.survey_consent (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  consented_at      timestamptz,
  pi_agreed         boolean not null default false,   -- [필수] 개인정보
  sensitive_agreed  boolean not null default false,   -- [필수] 민감정보(건강)
  revoked_at        timestamptz,
  notice_version    text,
  policy_version    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_survey_consent_updated on public.survey_consent;
create trigger trg_survey_consent_updated before update on public.survey_consent
  for each row execute function public.set_updated_at();
alter table public.survey_consent enable row level security;
drop policy if exists survey_consent_select_own on public.survey_consent;
create policy survey_consent_select_own on public.survey_consent for select using (auth.uid() = user_id);
revoke all on public.survey_consent from authenticated, anon;
grant select on public.survey_consent to authenticated;          -- 쓰기는 RPC 로만(S14)

-- ── D3 active ──
create or replace function public.survey_consent_active(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.consented_at is not null and c.pi_agreed and c.sensitive_agreed
       and (c.revoked_at is null or c.revoked_at < c.consented_at)
       and c.notice_version is not null
       and c.notice_version = (select current_notice_version from public.survey_consent_policy where id = true)
    from public.survey_consent c where c.user_id = p_uid
  ), false)
$$;
revoke all on function public.survey_consent_active(uuid) from public;
grant execute on function public.survey_consent_active(uuid) to authenticated, anon, service_role;

-- ── D6 동의 RPC ──
create or replace function public.give_survey_consent(p_pi boolean, p_sensitive boolean, p_channel text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_now timestamptz := now(); v_pol public.survey_consent_policy%rowtype;
begin
  if v_uid is null then raise exception 'login required' using errcode = '28000'; end if;
  if coalesce(p_pi, false) is not true or coalesce(p_sensitive, false) is not true then
    raise exception 'required consents (pi, sensitive) must both be true' using errcode = '22023';
  end if;
  select * into v_pol from public.survey_consent_policy where id = true;
  perform set_config('app.consent_channel', coalesce(p_channel, ''), true);
  insert into public.survey_consent as c (user_id, consented_at, pi_agreed, sensitive_agreed, revoked_at, notice_version, policy_version)
  values (v_uid, v_now, true, true, null, v_pol.current_notice_version, v_pol.current_policy_version)
  on conflict (user_id) do update set
    consented_at = v_now, pi_agreed = true, sensitive_agreed = true, revoked_at = null,
    notice_version = v_pol.current_notice_version, policy_version = v_pol.current_policy_version;
end $$;
revoke all on function public.give_survey_consent(boolean, boolean, text) from public, anon;
grant execute on function public.give_survey_consent(boolean, boolean, text) to authenticated;

-- ── D7 철회 = 설문 기록·건강 목표·연결된 비회원 설문 원자 삭제(동의 행 없어도 삭제권) ──
create or replace function public.revoke_survey_consent()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); d_sr int := 0; d_ug int := 0; d_an int := 0;
begin
  if v_uid is null then raise exception 'login required' using errcode = '28000'; end if;
  perform set_config('app.consent_channel', 'web_account', true);
  update public.survey_consent set revoked_at = now() where user_id = v_uid;
  delete from public.survey_responses where user_id = v_uid;          -- soft delete 행 포함
  get diagnostics d_sr = row_count;
  delete from public.user_goals where user_id = v_uid;
  get diagnostics d_ug = row_count;
  delete from public.anon_sessions where linked_user_id = v_uid;
  get diagnostics d_an = row_count;
  return jsonb_build_object('survey_responses', d_sr, 'user_goals', d_ug, 'anon_sessions', d_an);
end $$;
revoke all on function public.revoke_survey_consent() from public, anon;
grant execute on function public.revoke_survey_consent() to authenticated;

-- ── D8 상태 ──
create or replace function public.survey_consent_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row boolean; v_act boolean; v_cnt int; v_goal boolean; v_at timestamptz;
begin
  if v_uid is null then return jsonb_build_object('has_row', false, 'active', false, 'needs_reconsent', false,
       'survey_count', 0, 'goals_exists', false, 'consented_at', null); end if;
  select exists(select 1 from public.survey_consent where user_id = v_uid) into v_row;
  v_act := public.survey_consent_active(v_uid);
  select count(*) into v_cnt from public.survey_responses where user_id = v_uid and deleted_at is null;
  select exists(select 1 from public.user_goals where user_id = v_uid) into v_goal;
  select consented_at into v_at from public.survey_consent where user_id = v_uid;
  return jsonb_build_object(
    'has_row', v_row, 'active', v_act,
    'needs_reconsent', (v_row and not v_act and exists(
        select 1 from public.survey_consent where user_id = v_uid and consented_at is not null
           and (revoked_at is null or revoked_at < consented_at))),
    'survey_count', v_cnt, 'goals_exists', v_goal,
    'consented_at', case when v_act then v_at end);
end $$;
revoke all on function public.survey_consent_status() from public, anon;
grant execute on function public.survey_consent_status() to authenticated;

-- ── D4 서버 강제(RESTRICTIVE = 기존 정책과 AND) ──
drop policy if exists survey_responses_require_consent on public.survey_responses;
create policy survey_responses_require_consent on public.survey_responses
  as restrictive for all to authenticated, anon
  using (public.survey_consent_active(auth.uid()))
  with check (public.survey_consent_active(auth.uid()));
-- D5 만14세 서버 백스톱(INSERT 만 — 기존 행 soft delete UPDATE 에는 걸지 않음)
drop policy if exists survey_responses_age14_insert on public.survey_responses;
create policy survey_responses_age14_insert on public.survey_responses
  as restrictive for insert to authenticated, anon
  with check (coalesce(age, 0) >= 14);
drop policy if exists user_goals_require_consent on public.user_goals;
create policy user_goals_require_consent on public.user_goals
  as restrictive for all to authenticated, anon
  using (public.survey_consent_active(auth.uid()))
  with check (public.survey_consent_active(auth.uid()));

-- ── D9 비로그인 저장: 같은 행에 동의 기록(J2) ──
alter table public.anon_sessions add column if not exists consent_at timestamptz;
alter table public.anon_sessions add column if not exists consent_notice_version text;
alter table public.anon_sessions add column if not exists consent_policy_version text;

create or replace function public.submit_anon_survey(
  p_session_id text, p_age integer, p_pi boolean, p_sensitive boolean, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_pol public.survey_consent_policy%rowtype; j jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if coalesce(p_pi, false) is not true or coalesce(p_sensitive, false) is not true then
    raise exception 'required consents (pi, sensitive) must both be true' using errcode = '22023';
  end if;
  if coalesce(p_age, 0) < 14 then raise exception 'under 14' using errcode = '22023'; end if;
  if p_session_id is null or length(p_session_id) < 8 or length(p_session_id) > 100 then
    raise exception 'invalid session id' using errcode = '22023';
  end if;
  select * into v_pol from public.survey_consent_policy where id = true;
  insert into public.anon_sessions(session_id, device, age_group, gender, height_cm, weight_kg, bmi, symptoms, goals,
      lifestyle, current_supplements, conditions, family_history, recommendations, persona_id,
      consent_at, consent_notice_version, consent_policy_version)
  values (p_session_id, j->>'device', j->>'age_group', j->>'gender',
      (j->>'height_cm')::numeric, (j->>'weight_kg')::numeric, (j->>'bmi')::numeric,
      coalesce(j->'symptoms', '[]'::jsonb), coalesce(j->'goals', '[]'::jsonb),             -- 운영 컬럼 = jsonb(10-12 CSV F7)
      coalesce(j->'lifestyle', '{}'::jsonb),
      coalesce(j->'current_supplements', '[]'::jsonb), coalesce(j->'conditions', '[]'::jsonb),
      coalesce(j->'family_history', '[]'::jsonb),
      j->'recommendations', j->>'persona_id',
      now(), v_pol.current_notice_version, v_pol.current_policy_version);
end $$;
revoke all on function public.submit_anon_survey(text, integer, boolean, boolean, jsonb) from public;
grant execute on function public.submit_anon_survey(text, integer, boolean, boolean, jsonb) to anon, authenticated;

-- ── D17 비로그인 행 접근 봉쇄 + 연결 RPC(10-12 CSV F6) ──
--   기존 «allow authenticated read for linking» = 로그인 사용자 누구나 «연결 안 된 비회원 설문 전부»(건강 민감정보) SELECT 가능 → 제거.
--   연결은 세션 id 를 아는 본인만, RPC 로만(postLogin.ts). 직접 INSERT·SELECT·UPDATE·DELETE 전부 회수.
create or replace function public.link_anon_session(p_session_id text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); n int := 0;
begin
  if v_uid is null then raise exception 'login required' using errcode = '28000'; end if;
  if p_session_id is null or length(p_session_id) < 8 then return 0; end if;
  update public.anon_sessions set linked_user_id = v_uid
   where session_id = p_session_id and linked_user_id is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.link_anon_session(text) from public, anon;
grant execute on function public.link_anon_session(text) to authenticated;

drop policy if exists "allow anon insert" on public.anon_sessions;
drop policy if exists "allow authenticated read for linking" on public.anon_sessions;
drop policy if exists "allow authenticated link own session" on public.anon_sessions;
revoke insert, select, update, delete, truncate, references, trigger on public.anon_sessions from anon, authenticated;  -- S15·S20

-- ── D10 감사 로그(설문값·IP·UA 0) ──
create table if not exists public.survey_consent_audit (
  id                bigint generated always as identity primary key,
  user_id           uuid not null,
  event             text not null,   -- consent | revoke | update
  consented_at      timestamptz,
  revoked_at        timestamptz,
  pi_agreed         boolean,
  sensitive_agreed  boolean,
  notice_version    text,
  policy_version    text,
  notice_hash       text,
  consent_channel   text,
  occurred_at       timestamptz not null default now()
);
alter table public.survey_consent_audit enable row level security;
revoke all on public.survey_consent_audit from authenticated, anon;

create or replace function public.log_survey_consent()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event text;
begin
  v_event := case
    when NEW.revoked_at is not null and (TG_OP = 'INSERT' or OLD.revoked_at is distinct from NEW.revoked_at) then 'revoke'
    when TG_OP = 'INSERT' or OLD.consented_at is distinct from NEW.consented_at then 'consent'
    else 'update' end;
  insert into public.survey_consent_audit(user_id, event, consented_at, revoked_at, pi_agreed, sensitive_agreed,
      notice_version, policy_version, notice_hash, consent_channel)
  values (NEW.user_id, v_event, NEW.consented_at, NEW.revoked_at, NEW.pi_agreed, NEW.sensitive_agreed,
      NEW.notice_version, NEW.policy_version,
      (select notice_hash from public.survey_consent_policy where id = true),
      nullif(current_setting('app.consent_channel', true), ''));
  return NEW;
end $$;
drop trigger if exists trg_survey_consent_audit on public.survey_consent;
create trigger trg_survey_consent_audit after insert or update on public.survey_consent
  for each row execute function public.log_survey_consent();

create or replace function public.purge_survey_consent_audit()
returns integer language plpgsql security definer set search_path = public as $$
declare n int; begin
  delete from public.survey_consent_audit where occurred_at < now() - interval '3 years';
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.purge_survey_consent_audit() from public, authenticated, anon;
grant execute on function public.purge_survey_consent_audit() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge_survey_consent_audit') then
      perform cron.unschedule('purge_survey_consent_audit');
    end if;
    perform cron.schedule('purge_survey_consent_audit', '20 3 * * *', $c$ select public.purge_survey_consent_audit(); $c$);
  else
    raise notice '[163] ⚠️ pg_cron 미설치 — 감사 로그 3년 파기를 외부 스케줄러로 매일 실행(운영 필수).';
  end if;
end $$;

commit;

-- ── [확인] 결과표 1개(마지막 표만 CSV 로) ──
select 'policy' as k, current_notice_version || ' / ' || current_policy_version || ' / ' || left(notice_hash, 12) as v from public.survey_consent_policy
union all select 'checkup_policy', current_notice_version || ' / ' || current_policy_version from public.checkup_consent_policy
union all select 'rls_policy', tablename || ' · ' || policyname || ' · ' || permissive || ' ' || cmd from pg_policies
  where schemaname = 'public' and tablename in ('survey_responses','user_goals','survey_consent')
union all select 'func', proname from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('link_anon_session', 'survey_consent_active','give_survey_consent','revoke_survey_consent','survey_consent_status','submit_anon_survey','purge_survey_consent_audit','log_survey_consent')
union all select 'anon_sessions_grant_left', grantee || ' ' || privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'anon_sessions' and grantee in ('anon','authenticated')
union all select 'anon_sessions_policy_left', policyname from pg_policies where schemaname = 'public' and tablename = 'anon_sessions'
union all select 'cron', jobname || ' ' || schedule from cron.job where jobname like 'purge_%consent%'
order by 1, 2;

-- ── [되돌리기 · 긴급 시] ──
-- drop policy if exists survey_responses_require_consent on public.survey_responses;
-- drop policy if exists survey_responses_age14_insert on public.survey_responses;
-- drop policy if exists user_goals_require_consent on public.user_goals;
-- (anon_sessions 봉쇄 되돌리기는 하지 말 것 — 이전 상태가 민감정보 노출이었음. 앱 구버전 연결은 RPC 로 대체됨)
--   (동의·감사 테이블은 증빙이므로 삭제하지 말 것)
