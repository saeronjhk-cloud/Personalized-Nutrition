-- =============================================================================
-- 148: scan_miss — 먹선 바코드 미스 큐 v1 (2026-07-22, 세션34 트랙 A-1)
--
-- 목적: /scan 에서 "DB에 제품 없음"(404) 이 난 바코드를 수집해
--       ① 미스율 기준선 실측 ② 공공데이터(C005/HACCP) 보강 파이프라인의 입력 큐로 쓴다.
--
-- 컴플라이언스 설계:
--   - 사용자 연결 없음: user_id·visit_id·이메일 등 개인 식별자 열 자체가 없다.
--     바코드는 제품 식별자(공산품 GTIN)로 개인정보가 아니다.
--   - app_event 는 props 화이트리스트로 바코드 유입을 의도적으로 차단하고 있으므로
--     (phase_p15 설계 유지) 별도 익명 테이블로 분리한다.
--   - insert-only: 클라이언트는 쓰기만 가능. 조회는 어드민 RPC(get_scan_miss_top)만.
-- =============================================================================

create table if not exists public.scan_miss (
  id          uuid primary key default gen_random_uuid(),
  barcode     text not null check (barcode ~ '^[0-9]{8,14}$'),
  occurred_at timestamptz not null default now(),
  source      text not null default 'web_scan',
  -- 보강 파이프라인이 처리하면 채움(A-2). null = 미처리.
  resolved_at timestamptz,
  resolution  text  -- 'registered' | 'not_in_public_db' | 'invalid' (A-2 에서 사용)
);

create index if not exists scan_miss_barcode_idx  on public.scan_miss (barcode);
create index if not exists scan_miss_occurred_idx on public.scan_miss (occurred_at desc);
create index if not exists scan_miss_unresolved_idx on public.scan_miss (occurred_at desc)
  where resolved_at is null;

alter table public.scan_miss enable row level security;

-- 쓰기: 익명·로그인 모두 허용(스캔은 비로그인 기능). 형식은 CHECK 가 방어.
drop policy if exists scan_miss_insert on public.scan_miss;
create policy scan_miss_insert on public.scan_miss
  for insert to anon, authenticated
  with check (true);

-- select/update/delete 정책 없음 = 클라이언트 조회 불가. 어드민은 아래 RPC 로만.

-- ─────────────────────────────────────────────────────────────────────────────
-- 어드민 집계: 미스 상위 바코드 (get_scan_metrics 와 동일 가드)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_scan_miss_top(days integer default 30, max_rows integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  since  timestamptz := now() - make_interval(days => greatest(1, days));
begin
  if coalesce(auth.jwt() ->> 'email', '') <> all (array['saeronjhk@gmail.com']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'window_days',  days,
    'total_misses',      (select count(*)::int from public.scan_miss where occurred_at >= since),
    'distinct_barcodes', (select count(distinct barcode)::int from public.scan_miss where occurred_at >= since),
    'unresolved',        (select count(distinct barcode)::int from public.scan_miss where occurred_at >= since and resolved_at is null),
    'top_barcodes', coalesce((
      select jsonb_agg(jsonb_build_object('barcode', barcode, 'n', n, 'last_at', last_at, 'resolved', resolved) order by n desc)
      from (
        select barcode,
               count(*)::int as n,
               max(occurred_at) as last_at,
               bool_or(resolved_at is not null) as resolved
        from public.scan_miss
        where occurred_at >= since
        group by barcode
        order by count(*) desc
        limit greatest(1, max_rows)
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_scan_miss_top(integer, integer) from public, anon;
grant execute on function public.get_scan_miss_top(integer, integer) to authenticated;  -- 내부 어드민 가드가 비어드민 차단
