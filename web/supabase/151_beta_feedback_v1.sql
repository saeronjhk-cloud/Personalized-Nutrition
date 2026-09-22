-- ============================================================================
-- 151_beta_feedback_v1.sql — 사진 수집 베타 패널 피드백 창구
-- 2026-09-22 (세션54)
-- ============================================================================
-- 무엇을 더하나
--   public.beta_feedback — 베타 패널이 결과 화면에서 보내는 «음식명 정정 / 버그 / 의견».
--   analysis_job.id(job_id) 를 함께 저장해 «어느 사진에 대한 말인지»를 SQL 로 바로 잇는다.
--
-- ★ 왜 app_event 가 아니라 별도 테이블인가
--   app_event 는 ALLOWED_PROP_KEYS 로 자유 텍스트를 «막는» 정책이다(150 참조). 피드백은
--   자유 텍스트가 본체라 그 정책과 충돌한다. 그래서 따로 둔다. 이벤트 enum 도 건드리지 않는다.
--
-- ★ 왜 정정 칩만으로 부족한가
--   MealResult 의 정정 칩은 «저장 전»에만 보인다(IP/179 §3-1). 저장 뒤엔 사용자가 「틀렸다」고
--   말할 방법이 없었다. 이 테이블은 저장 전후 무관하게 받는다.
--
-- ⚠ 이 파일을 만들었다고 적용된 게 아니다. **Supabase SQL Editor 에 붙여넣어야 한다.**
-- 멱등: 여러 번 실행해도 안전하다.
-- ============================================================================

create table if not exists public.beta_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id      uuid references public.analysis_job(id) on delete set null,
  -- src/lib/betaPanel.ts 의 FEEDBACK_KINDS 와 «글자까지» 같아야 한다 (betaPanel_wiring 테스트가 대조)
  kind        text not null check (kind in ('correction', 'bug', 'opinion')),
  message     text not null check (char_length(message) between 1 and 1000),
  -- 정정일 때: 사용자가 생각하는 «맞는 음식명». 자유 텍스트. 집계 시 food30 30종과 대조한다.
  food_name   text check (food_name is null or char_length(food_name) <= 60),
  page        text not null default '/meal' check (char_length(page) <= 80),
  created_at  timestamptz not null default now()
);

create index if not exists beta_feedback_created_idx on public.beta_feedback (created_at desc);
create index if not exists beta_feedback_job_idx     on public.beta_feedback (job_id);

alter table public.beta_feedback enable row level security;

-- 쓰기: 로그인 사용자만, 자기 uid 로만. (식사 분석은 로그인 필수이므로 익명 경로 없음)
drop policy if exists beta_feedback_insert on public.beta_feedback;
create policy beta_feedback_insert on public.beta_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- 읽기: 본인 것만 (「내가 보낸 의견」 화면을 나중에 붙일 여지). 어드민은 SQL Editor 로 본다.
drop policy if exists beta_feedback_select_own on public.beta_feedback;
create policy beta_feedback_select_own on public.beta_feedback
  for select to authenticated
  using (user_id = auth.uid());

-- update/delete 정책 없음 = 클라이언트에서 수정·삭제 불가.
