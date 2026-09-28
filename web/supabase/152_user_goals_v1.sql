-- ============================================================================
-- 152_user_goals_v1.sql — 내 건강 목표 저장소 (웹앱트랙 Phase G)
-- 2026-09-28
-- ============================================================================
-- 무엇을 더하나
--   public.user_goals — 사용자당 1행. 식사 기록(/meal) «내 건강 목표» 카드에서 편집.
--   맞춤 영양제 추천(통합 엔진)이 이 값을 설문 answers.목표 로 주입한다(엔진 수치 불변).
--
-- 하위 호환
--   행이 없으면 앱이 최신 survey_responses.goals 로 폴백하고, 첫 로드 때 1회 upsert(시드)한다.
--   (lib/userGoals.ts loadEffectiveGoals). 아래 선택 블록으로 일괄 백필도 가능.
--   survey_responses.goals 컬럼은 **삭제하지 않는다**(폴백·과거 결과 재현·get_insights 집계).
--
-- 민감정보
--   건강 목표는 처리방침상 민감정보(건강에 관한 정보). 입력 화면에서 설문 민감정보 동의
--   (sf_sensitive_consent)를 받은 경우에만 저장한다. 탈퇴 시 auth.users FK cascade 로 삭제.
--
-- ⚠ 이 파일을 만들었다고 적용된 게 아니다. **Supabase SQL Editor(운영 ref lrnuqhpgyuizfggxgxpl)에 붙여넣어야 한다.**
-- 멱등: 여러 번 실행해도 안전하다. 적용 전에도 앱은 폴백으로 동작한다(목표 저장만 실패).
-- ============================================================================

create table if not exists public.user_goals (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- domain/goals/goals.ts GOAL_OPTIONS 13종 id (앱에서 sanitize). 최대 13개.
  goals       text[] not null default '{}' check (coalesce(array_length(goals, 1), 0) <= 13),
  updated_at  timestamptz not null default now()
);

alter table public.user_goals enable row level security;

drop policy if exists user_goals_select_own on public.user_goals;
create policy user_goals_select_own on public.user_goals
  for select to authenticated using (user_id = auth.uid());

drop policy if exists user_goals_insert_own on public.user_goals;
create policy user_goals_insert_own on public.user_goals
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_goals_update_own on public.user_goals;
create policy user_goals_update_own on public.user_goals
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_goals_delete_own on public.user_goals;
create policy user_goals_delete_own on public.user_goals
  for delete to authenticated using (user_id = auth.uid());

-- ── (선택) 일괄 백필: 최신 활성 설문의 goals 를 user_goals 로 ─────────────────
-- 앱의 1회 시드와 같은 결과. 실행하지 않아도 무방.
-- insert into public.user_goals (user_id, goals)
-- select distinct on (user_id) user_id, coalesce(goals, '{}')
--   from public.survey_responses
--  where deleted_at is null and user_id is not null
--  order by user_id, created_at desc
-- on conflict (user_id) do nothing;

-- ── 확인 ──────────────────────────────────────────────────────────────────────
-- select policyname, cmd from pg_policies where tablename = 'user_goals';
