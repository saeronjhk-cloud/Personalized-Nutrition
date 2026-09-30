-- ============================================================================
-- 153_beta_feedback_notify_v1.sql — 뉴트리렌즈 베타 제보 → 관리자 알림 메일 트리거
-- 2026-09-30 (웹앱트랙)
-- ============================================================================
-- 흐름: beta_feedback INSERT → (이 트리거, pg_net 비동기) → Edge Function beta-feedback-notify → Resend 메일
--   · pg_net 은 비동기 → 메일 실패·지연이 «제보 저장»을 막지 않는다.
--   · 보내는 값은 id·kind·job_id·page·created_at 뿐. message·food_name·user_id 는 싣지 않는다
--     (Resend 는 현행 처리방침 수탁자 목록에 없음 — 개인정보 국외이전 신규 발생 방지).
--   · URL·공유 비밀은 코드/깃에 두지 않고 Supabase Vault 에 둔다(아래 ② 를 SQL Editor 에서 1회).
--   · Vault 값이 없으면 트리거는 아무것도 안 하고 통과(설정 전 적용해도 안전).
-- 멱등: 여러 번 실행해도 안전.
-- ============================================================================

-- ① 확장
create extension if not exists pg_net with schema extensions;

-- ② Vault 비밀 2개 — ⚠ 이 블록은 «주석을 풀고 값을 바꿔» SQL Editor 에서 1회만 실행 (깃에 실값 금지)
-- select vault.create_secret('https://lrnuqhpgyuizfggxgxpl.supabase.co/functions/v1/beta-feedback-notify', 'beta_feedback_notify_url');
-- select vault.create_secret('<NOTIFY_SECRET 과 같은 값>', 'beta_feedback_notify_secret');
--   값을 바꿀 때: select vault.update_secret((select id from vault.secrets where name='beta_feedback_notify_secret'), '<새 값>');

-- ③ 트리거 함수
create or replace function public.beta_feedback_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'beta_feedback_notify_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'beta_feedback_notify_secret' limit 1;
  if v_url is null or v_secret is null then
    return new;  -- 미설정: 조용히 통과
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('record', jsonb_build_object(
                 'id', new.id, 'kind', new.kind, 'job_id', new.job_id,
                 'page', new.page, 'created_at', new.created_at)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- 알림 실패가 제보 저장을 절대 막지 않도록
  raise warning '[beta_feedback_notify] %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.beta_feedback_notify() from public, anon, authenticated;

drop trigger if exists beta_feedback_notify_trg on public.beta_feedback;
create trigger beta_feedback_notify_trg
  after insert on public.beta_feedback
  for each row execute function public.beta_feedback_notify();

-- ④ 확인
-- select tgname from pg_trigger where tgrelid = 'public.beta_feedback'::regclass and not tgisinternal;   -- beta_feedback_notify_trg
-- select name from vault.secrets where name like 'beta_feedback_notify_%';                               -- 2행
-- 발송 결과(최근): select id, status_code, left(content::text, 200), created from net._http_response order by created desc limit 5;
