-- =====================================================================
-- 160 · 검진 신규 저장 임시 중단 (서버측) — 검진 임시 조치 v1
-- 근거: IP/integration/검진동의_외부자문_회신기록_v1.md 공통 C2 · 평가 IP/integration/checkup_interim_pause_eval_v1.md W4
-- 내용: 로그인 이용자(authenticated)·익명(anon)의 checkup_records·biomarker_values INSERT 권한 회수.
--       SELECT(본인 열람)·UPDATE(soft delete = 삭제권)·DELETE 는 그대로. service_role 영향 없음.
-- 성격: 멱등 · 비파괴(데이터 변화 0) · 되돌리기 아래.
-- 적용: Supabase SQL Editor 에 전체 붙여 넣고 Run.
-- =====================================================================
begin;
revoke insert on table public.checkup_records  from authenticated, anon;
revoke insert on table public.biomarker_values from authenticated, anon;
commit;

-- [확인] 아래 결과에서 INSERT 행이 authenticated·anon 에 없어야 함
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('checkup_records','biomarker_values')
  and grantee in ('authenticated','anon')
order by table_name, grantee, privilege_type;

-- [되돌리기] 동의 서버 기록(SQL 161) 적용·검증 후에만:
-- grant insert on table public.checkup_records  to authenticated;
-- grant insert on table public.biomarker_values to authenticated;
