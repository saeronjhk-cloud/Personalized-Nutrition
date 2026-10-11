-- =====================================================================
-- 162 · give_checkup_combine — 필수 동의 후 선택(결합) 동의만 추가하는 RPC
-- 근거: 2026-10-11 실측 — 처음 동의 화면에서 선택을 체크하지 않으면 이후 결합 동의 경로가 없음.
--       정본 IP/검진동의_고지문안_정본_v2_20261007.md §4 버튼 C · 평가 IP/integration/checkup_consent_v2_eval_v1.md S16·S17
-- 성격: 멱등(CREATE OR REPLACE) · 데이터 변화 0. 감사 로그는 161 트리거가 combine_consent 로 적재.
-- 적용: Supabase SQL Editor 에 전체 붙여 넣고 Run.
-- =====================================================================
begin;
create or replace function public.give_checkup_combine(p_channel text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'login required' using errcode = '28000'; end if;
  if not public.checkup_consent_core_active(v_uid) then
    raise exception 'core consent required before combine consent' using errcode = '22023';
  end if;
  perform set_config('app.consent_channel', coalesce(p_channel, ''), true);
  update public.checkup_consent
     set combine_consented_at = now(), combine_revoked_at = null
   where user_id = v_uid;
end $$;
revoke all on function public.give_checkup_combine(text) from public, anon;
grant execute on function public.give_checkup_combine(text) to authenticated;
commit;

-- [확인] 1행: give_checkup_combine
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = 'give_checkup_combine';
