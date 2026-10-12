-- =====================================================================
-- 164 · anon_sessions.linked_user_id → auth.users ON DELETE CASCADE
--   회원 탈퇴 시 «계정에 연결된 비회원 설문»도 함께 삭제(처리방침 3. «회원 탈퇴 시 연결된 설문 응답 포함 삭제»).
-- 평가: IP/integration/anon_link_cascade_eval_v1.md (E01~E07)
-- 근거: 탈퇴 Edge(account-delete 배포본 107)는 delete_user_data RPC → auth.admin.deleteUser 순서.
--       delete_user_data 는 anon_sessions 를 지우지 않음(10-12 CSV F9) → deleteUser 의 FK cascade 로 정리.
--       delete_user_data 본문은 건드리지 않음(라이브 본문과 IP/112 가 다를 수 있어 재작성 위험).
-- 성격: 멱등. ⚠️ 파괴적 1건 — 이미 탈퇴한 계정(auth.users 에 없음)에 연결돼 남아 있던 비회원 설문 행 삭제(전수 파기 이행).
-- 적용: SQL Editor 전체 Run → 마지막 결과표 CSV 첨부.
-- =====================================================================
begin;

-- (0) 실행 전 현황 기록(결과표에 함께 나옴)
create temp table _c164 on commit drop as
select
  (select count(*) from public.anon_sessions) as rows_before,
  (select count(*) from public.anon_sessions where linked_user_id is not null) as linked_before,
  (select count(*) from public.anon_sessions a
     where a.linked_user_id is not null and not exists (select 1 from auth.users u where u.id = a.linked_user_id)) as orphan_before;

-- (1) 탈퇴 계정에 연결된 채 남은 행 파기
delete from public.anon_sessions a
 where a.linked_user_id is not null
   and not exists (select 1 from auth.users u where u.id = a.linked_user_id);

-- (2) FK + ON DELETE CASCADE (멱등)
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.anon_sessions'::regclass and conname = 'anon_sessions_linked_user_id_fkey'
  ) then
    alter table public.anon_sessions
      add constraint anon_sessions_linked_user_id_fkey
      foreign key (linked_user_id) references auth.users(id) on delete cascade;
  end if;
end $$;
create index if not exists anon_sessions_linked_user_id_idx on public.anon_sessions(linked_user_id) where linked_user_id is not null;

-- (3) 확인표
select 'before' as k, 'rows=' || rows_before || ' linked=' || linked_before || ' orphan=' || orphan_before as v from _c164
union all
select 'after', 'rows=' || (select count(*) from public.anon_sessions) || ' linked=' ||
       (select count(*) from public.anon_sessions where linked_user_id is not null) || ' orphan=' ||
       (select count(*) from public.anon_sessions a where a.linked_user_id is not null
          and not exists (select 1 from auth.users u where u.id = a.linked_user_id))
union all
select 'fk', conname || ' · ' || pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.anon_sessions'::regclass and contype = 'f';

commit;

-- ── [되돌리기] FK 만 제거(파기된 행은 복구 불가 — 백업 7일 내 운영 절차)
-- alter table public.anon_sessions drop constraint if exists anon_sessions_linked_user_id_fkey;
