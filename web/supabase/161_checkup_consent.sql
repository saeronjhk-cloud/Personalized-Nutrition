-- =====================================================================
-- 161 · checkup_consent — 검진 민감정보 동의 서버 기록 v2 (필수/선택 분리 · 서버 강제 · 감사 로그 3년)
-- 평가: IP/integration/checkup_consent_v2_eval_v1.md (D1~D13 · S01~S15)
-- 문구 정본: IP/검진동의_고지문안_정본_v2_20261007.md (notice_hash = 그 §1 블록 sha256)
-- 선례: IP/111 · IP/115 (식사 사진) — 단, 쓰기는 RPC 로만(버전·시각 서버가 채움).
-- 성격: 멱등 · 비파괴(검진 데이터 변화 0). ⚠️ 적용 즉시 «v2 동의 없는 이용자»는 검진 기록 조회 불가(D5).
--       → 앱 v2(게이트) 배포와 같은 날 실행. 실행 후 제이는 /checkup 에서 재동의(X1).
-- SQL 160(INSERT 회수)은 이 파일이 되돌리지 않음 — 실측 후 별도(D13, 맨 아래 주석).
-- 적용: Supabase SQL Editor 에 전체 붙여 넣고 Run.
-- =====================================================================
begin;

-- ── D2 싱글턴: 현행 동의문/처리방침 버전 ──
create table if not exists public.checkup_consent_policy (
  id                      boolean primary key default true,
  current_notice_version  text not null,          -- 재동의 판정 기준(동의문 내용 변경 시에만 올림)
  current_policy_version  text not null,          -- 기록용(처리방침 오탈자 수정 등은 이것만 올림)
  notice_hash             text,
  updated_at              timestamptz not null default now(),
  constraint checkup_consent_policy_singleton check (id = true)
);
insert into public.checkup_consent_policy(id, current_notice_version, current_policy_version, notice_hash)
values (true, 'checkup_v2', '13_v5.1', 'eef6c342042e1633d3d796179632dcd5933f6dd4ab823d0f2c249161a61996cc')
on conflict (id) do nothing;
alter table public.checkup_consent_policy enable row level security;
revoke all on public.checkup_consent_policy from authenticated, anon;

-- ── D1 동의 기록 ──
create table if not exists public.checkup_consent (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  core_consented_at     timestamptz,   -- (필수) 민감정보 수집·이용 동의
  combine_consented_at  timestamptz,   -- (선택) 설문·식사 결합 이용 동의
  combine_revoked_at    timestamptz,
  revoked_at            timestamptz,   -- 필수 동의 철회(= 기록 전부 삭제)
  age_confirmed_14plus  boolean not null default false,
  notice_version        text,
  policy_version        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
drop trigger if exists trg_checkup_consent_updated on public.checkup_consent;
create trigger trg_checkup_consent_updated before update on public.checkup_consent
  for each row execute function public.set_updated_at();

alter table public.checkup_consent enable row level security;
drop policy if exists checkup_consent_select_own on public.checkup_consent;
create policy checkup_consent_select_own on public.checkup_consent
  for select using (auth.uid() = user_id);
revoke all on public.checkup_consent from authenticated, anon;
grant select on public.checkup_consent to authenticated;      -- 쓰기는 RPC 로만(S15)

-- ── D3·D4 active 판정 ──
create or replace function public.checkup_consent_core_active(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.core_consented_at is not null
       and c.age_confirmed_14plus = true
       and (c.revoked_at is null or c.revoked_at < c.core_consented_at)
       and c.notice_version is not null
       and c.notice_version = (select current_notice_version from public.checkup_consent_policy where id = true)
    from public.checkup_consent c where c.user_id = p_uid
  ), false)
$$;

create or replace function public.checkup_consent_combine_active(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.checkup_consent_core_active(p_uid) and coalesce((
    select c.combine_consented_at is not null
       and (c.combine_revoked_at is null or c.combine_revoked_at < c.combine_consented_at)
    from public.checkup_consent c where c.user_id = p_uid
  ), false)
$$;
grant execute on function public.checkup_consent_core_active(uuid)    to authenticated, service_role;
grant execute on function public.checkup_consent_combine_active(uuid) to authenticated, service_role;

-- ── D9 동의 기록 RPC ──
create or replace function public.give_checkup_consent(
  p_core boolean, p_age14 boolean, p_combine boolean, p_channel text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_pol public.checkup_consent_policy%rowtype;
begin
  if v_uid is null then raise exception 'login required' using errcode = '28000'; end if;
  if coalesce(p_core, false) is not true or coalesce(p_age14, false) is not true then
    raise exception 'required consents (core, age14) must both be true' using errcode = '22023';
  end if;
  select * into v_pol from public.checkup_consent_policy where id = true;
  perform set_config('app.consent_channel', coalesce(p_channel, ''), true);
  insert into public.checkup_consent as c (user_id, core_consented_at, combine_consented_at, combine_revoked_at,
                                           revoked_at, age_confirmed_14plus, notice_version, policy_version)
  values (v_uid, v_now,
          case when p_combine then v_now end,
          null, null, true, v_pol.current_notice_version, v_pol.current_policy_version)
  on conflict (user_id) do update set
    core_consented_at    = v_now,
    revoked_at           = null,
    age_confirmed_14plus = true,
    notice_version       = v_pol.current_notice_version,
    policy_version       = v_pol.current_policy_version,
    combine_consented_at = case when p_combine then v_now else c.combine_consented_at end,
    combine_revoked_at   = case when p_combine then null
                                when c.combine_consented_at is not null and c.combine_revoked_at is null then v_now
                                else c.combine_revoked_at end;
end $$;
revoke all on function public.give_checkup_consent(boolean, boolean, boolean, text) from public, anon;
grant execute on function public.give_checkup_consent(boolean, boolean, boolean, text) to authenticated;

-- ── D7 철회 A: 결합 이용만 철회(서버 저장 파생물 없음 — 평가 F3) ──
create or replace function public.revoke_checkup_combine()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'login required' using errcode = '28000'; end if;
  perform set_config('app.consent_channel', 'web_account', true);
  update public.checkup_consent set combine_revoked_at = now()
   where user_id = v_uid and combine_consented_at is not null
     and (combine_revoked_at is null or combine_revoked_at < combine_consented_at);
end $$;
revoke all on function public.revoke_checkup_combine() from public, anon;
grant execute on function public.revoke_checkup_combine() to authenticated;

-- ── D8 철회 B: 필수 동의 철회 = 검진 기록 원자 삭제(동의 행 없어도 삭제권 보장) ──
create or replace function public.revoke_checkup_consent()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); d_bv int := 0; d_cr int := 0;
begin
  if v_uid is null then raise exception 'login required' using errcode = '28000'; end if;
  perform set_config('app.consent_channel', 'web_account', true);
  update public.checkup_consent
     set revoked_at = now(),
         combine_revoked_at = case when combine_consented_at is not null then now() else combine_revoked_at end
   where user_id = v_uid;
  delete from public.biomarker_values bv
   where bv.checkup_record_id in (select id from public.checkup_records where user_id = v_uid);
  get diagnostics d_bv = row_count;
  delete from public.checkup_records where user_id = v_uid;
  get diagnostics d_cr = row_count;
  return jsonb_build_object('biomarker_values', d_bv, 'checkup_records', d_cr);
end $$;
revoke all on function public.revoke_checkup_consent() from public, anon;
grant execute on function public.revoke_checkup_consent() to authenticated;

-- ── D11 상태 ──
create or replace function public.checkup_consent_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row boolean; v_core boolean; v_cnt int;
begin
  if v_uid is null then return jsonb_build_object('has_row', false, 'core_active', false,
       'combine_active', false, 'needs_reconsent', false, 'record_count', 0); end if;
  select exists(select 1 from public.checkup_consent where user_id = v_uid) into v_row;
  v_core := public.checkup_consent_core_active(v_uid);
  select count(*) into v_cnt from public.checkup_records where user_id = v_uid and deleted_at is null;
  return jsonb_build_object(
    'has_row', v_row,
    'core_active', v_core,
    'combine_active', public.checkup_consent_combine_active(v_uid),
    'needs_reconsent', (v_row and not v_core and exists(
        select 1 from public.checkup_consent where user_id = v_uid
           and core_consented_at is not null and (revoked_at is null or revoked_at < core_consented_at))),
    'record_count', v_cnt);
end $$;
revoke all on function public.checkup_consent_status() from public, anon;
grant execute on function public.checkup_consent_status() to authenticated;

-- ── D5 서버 강제: 검진 테이블 클라이언트 접근 전부 core 동의 필요(RESTRICTIVE = 기존 정책과 AND) ──
drop policy if exists checkup_records_require_consent on public.checkup_records;
create policy checkup_records_require_consent on public.checkup_records
  as restrictive for all to authenticated, anon
  using (public.checkup_consent_core_active(auth.uid()))
  with check (public.checkup_consent_core_active(auth.uid()));
drop policy if exists biomarker_values_require_consent on public.biomarker_values;
create policy biomarker_values_require_consent on public.biomarker_values
  as restrictive for all to authenticated, anon
  using (public.checkup_consent_core_active(auth.uid()))
  with check (public.checkup_consent_core_active(auth.uid()));

-- ── D10 감사 로그(건강정보·IP·UA 0) ──
create table if not exists public.checkup_consent_audit (
  id                    bigint generated always as identity primary key,
  user_id               uuid not null,
  event                 text not null,   -- consent | consent+combine_consent | consent+combine_revoke | combine_consent | combine_revoke | revoke | update
  core_consented_at     timestamptz,
  combine_consented_at  timestamptz,
  combine_revoked_at    timestamptz,
  revoked_at            timestamptz,
  age_confirmed_14plus  boolean,
  notice_version        text,
  policy_version        text,
  notice_hash           text,
  consent_channel       text,
  occurred_at           timestamptz not null default now()
);
alter table public.checkup_consent_audit enable row level security;
revoke all on public.checkup_consent_audit from authenticated, anon;

create or replace function public.log_checkup_consent()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event text;
begin
  v_event := case
    when NEW.revoked_at is not null and (TG_OP = 'INSERT' or OLD.revoked_at is distinct from NEW.revoked_at) then 'revoke'
    when TG_OP = 'INSERT' or OLD.core_consented_at is distinct from NEW.core_consented_at then
      case when NEW.combine_consented_at is not null and NEW.combine_revoked_at is null
                and (TG_OP = 'INSERT' or OLD.combine_consented_at is distinct from NEW.combine_consented_at)
           then 'consent+combine_consent'
           when TG_OP = 'UPDATE' and NEW.combine_revoked_at is not null
                and OLD.combine_revoked_at is distinct from NEW.combine_revoked_at
           then 'consent+combine_revoke'
           else 'consent' end
    when NEW.combine_revoked_at is not null and OLD.combine_revoked_at is distinct from NEW.combine_revoked_at then 'combine_revoke'
    when OLD.combine_consented_at is distinct from NEW.combine_consented_at then 'combine_consent'
    else 'update' end;
  insert into public.checkup_consent_audit(user_id, event, core_consented_at, combine_consented_at,
      combine_revoked_at, revoked_at, age_confirmed_14plus, notice_version, policy_version, notice_hash, consent_channel)
  values (NEW.user_id, v_event, NEW.core_consented_at, NEW.combine_consented_at, NEW.combine_revoked_at,
      NEW.revoked_at, NEW.age_confirmed_14plus, NEW.notice_version, NEW.policy_version,
      (select notice_hash from public.checkup_consent_policy where id = true),
      nullif(current_setting('app.consent_channel', true), ''));
  return NEW;
end $$;
drop trigger if exists trg_checkup_consent_audit on public.checkup_consent;
create trigger trg_checkup_consent_audit after insert or update on public.checkup_consent
  for each row execute function public.log_checkup_consent();

create or replace function public.purge_checkup_consent_audit()
returns integer language plpgsql security definer set search_path = public as $$
declare n int; begin
  delete from public.checkup_consent_audit where occurred_at < now() - interval '3 years';
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.purge_checkup_consent_audit() from public, authenticated, anon;
grant execute on function public.purge_checkup_consent_audit() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge_checkup_consent_audit') then
      perform cron.unschedule('purge_checkup_consent_audit');
    end if;
    perform cron.schedule('purge_checkup_consent_audit', '10 3 * * *', $c$ select public.purge_checkup_consent_audit(); $c$);
    raise notice '[161] pg_cron 등록: purge_checkup_consent_audit (매일 03:10, 3년 경과 파기)';
  else
    raise notice '[161] ⚠️ pg_cron 미설치 — 감사 로그 3년 파기를 외부 스케줄러로 매일 실행(운영 필수).';
  end if;
end $$;

commit;

-- ── [확인] 결과 4개 ──
select current_notice_version, current_policy_version, left(notice_hash, 12) as hash12 from public.checkup_consent_policy;
select tablename, policyname, permissive, cmd from pg_policies
 where schemaname = 'public' and tablename in ('checkup_records','biomarker_values','checkup_consent') order by 1, 2;
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like '%checkup_consent%' order by 1;
select jobname, schedule from cron.job where jobname like 'purge_%consent%' order by 1;

-- ── [되돌리기 · 161 전체] (긴급 시) ──
-- drop policy if exists checkup_records_require_consent on public.checkup_records;
-- drop policy if exists biomarker_values_require_consent on public.biomarker_values;
--   (동의·감사 테이블은 증빙이므로 삭제하지 말 것)

-- ── [D13 · 실측 통과 후에만] SQL 160 되돌리기 ──
-- grant insert on table public.checkup_records  to authenticated;
-- grant insert on table public.biomarker_values to authenticated;
