-- =====================================================================
-- 165 · anon_sessions.linked_user_id FK 를 ON DELETE SET NULL → CASCADE 로 교체
-- 원인(10-12 16:01, SQL 164 결과표): 같은 이름의 FK `anon_sessions_linked_user_id_fkey` 가 **이미 ON DELETE SET NULL** 로 존재
--   → 164 의 «이름이 있으면 건너뜀» 분기로 교체되지 않음. 그동안 탈퇴하면 연결 행이 지워지지 않고 «비회원 행»으로 남았음.
-- 평가: IP/integration/anon_link_cascade_eval_v1.md (E01~E08)
-- 성격: 멱등 · 데이터 변화 0(제약만 교체). 적용: SQL Editor 전체 Run → 결과표 CSV.
-- =====================================================================
begin;

do $$
declare v_del "char";
begin
  select confdeltype into v_del from pg_constraint
   where conrelid = 'public.anon_sessions'::regclass and conname = 'anon_sessions_linked_user_id_fkey';
  if v_del is distinct from 'c' then          -- 없음 또는 SET NULL(n)·NO ACTION(a) 등
    alter table public.anon_sessions drop constraint if exists anon_sessions_linked_user_id_fkey;
    alter table public.anon_sessions
      add constraint anon_sessions_linked_user_id_fkey
      foreign key (linked_user_id) references auth.users(id) on delete cascade;
    raise notice '[165] FK 교체: % → cascade', coalesce(v_del::text, '없음');
  end if;
end $$;
create index if not exists anon_sessions_linked_user_id_idx on public.anon_sessions(linked_user_id) where linked_user_id is not null;

select 'fk' as k, conname || ' · ' || pg_get_constraintdef(oid) as v from pg_constraint
 where conrelid = 'public.anon_sessions'::regclass and contype = 'f'
union all
select 'rows', 'rows=' || count(*) || ' linked=' || count(linked_user_id) from public.anon_sessions;

commit;
