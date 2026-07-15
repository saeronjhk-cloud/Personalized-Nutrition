-- [사본] 정본은 IP/136_meokseon_traffic_light_snapshot_v1.sql 입니다 (원칙3: IP 분리).
--        이 파일을 직접 고치지 마세요 — 정본을 고치고 사본을 갱신하세요.
--        검증: python3 IP/evals/meokseon_tl_v1/run_sql_eval.py

-- =============================================================================
-- 136_meokseon_traffic_light_snapshot_v1.sql
-- 세션30 · D-1(오케스트레이터를 영양공식 프로젝트로 이관) 실행 · IP/136 §4 P0-1
--
-- 적용 대상: **영양공식 Supabase (lrnuqhpgyuizfggxgxpl)** — vita50-dev 아님.
-- 목적: 오케스트레이터 loadScans7d 가 **loaders.ts 무수정**으로 scan_history 를 읽게 한다.
--
-- 설계 원칙(IP/136 §4):
--  · 신호등 색은 "제품 팩트"다(product 당 1행, 사용자 무관) → 개인 건강추론 파생정보가 아니다.
--    기존 doctrine "스캔 이력엔 제품 팩트만 저장"(phase_p15…sql:91) 과 정합.
--  · 자체 임계값을 만들지 않는다. 먹선 정본 판정(traffic_light)을 **그대로 스냅샷**한다.
--    (web/src/lib/meokseon.ts:51 — "개인화는 이 색을 소비만 하고 자체 임계를 만들지 않는다")
--  · 색 결측(null) = "판정 없음" ≠ 안전. red 만 카운트하는 producers.ts 철학과 정합(fail-safe).
--  · 멱등(반복 실행 안전). 되돌리기 = drop column / drop table (§4 블록).
--
-- 계약(loaders.ts:408-443 loadScans7d — 이 파일은 아래 5개 컬럼만 요구한다):
--    select scan_id, scanned_at, sodium_color, sugars_color
--      where user_id = <uuid> and scanned_at >= <utc> and scanned_at < <utc>
--      order by scanned_at asc limit 200
--  → scan_id 는 loaders.ts:414 가 **문자열로 하드코딩**하므로 이 이름의 컬럼이 반드시 있어야 한다.
--    (없으면 42703 undefined_column)
--
-- 개인정보(IP/136 §6): 본 마이그레이션은 **신규 결합(linkage)을 만들지 않는다.**
--   대응표 없음 · 신규 수탁자 없음 · 신규 국외이전 없음 · 기존 RLS/cascade 파기 그대로 유지.
--   ⚠️ 단, "스캔이력을 코칭에 이용"은 **이용 목적 확대**이므로 처리방침 **선(先)변경**이 배포 게이트다
--      (IP/136 §6.3, 125:50). 이 SQL 적용 자체는 게이트 대상이 아니다(스키마는 130 봉합 범위 밖).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) 제품 신호등 캐시 — 개인정보 아님(제품 팩트). 사용자 식별자를 담지 않는다.
--     원천: 먹선 공개 API GET /api/products/:barcode → traffic_light.nutrients.*.color
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.meokseon_tl_cache (
  barcode       text primary key,
  sodium_color  text check (sodium_color  in ('green','yellow','red')),  -- null 허용 = 판정없음
  sugars_color  text check (sugars_color  in ('green','yellow','red')),
  sat_fat_color text check (sat_fat_color in ('green','yellow','red')),  -- 확장 여지(현재 미사용)
  product_id    bigint,        -- 먹선 products.product_id (참조용, FK 아님 — 별도 DB)
  refreshed_at  timestamptz not null default now(),
  source        text not null default 'meokseon_api'
);

comment on table public.meokseon_tl_cache is
  '먹선 신호등 정본 판정의 로컬 캐시. 제품 단위 팩트이며 개인정보를 포함하지 않는다. 자체 임계 산출 금지 — API 값만 스냅샷.';

alter table public.meokseon_tl_cache enable row level security;
drop policy if exists meokseon_tl_cache_read on public.meokseon_tl_cache;
create policy meokseon_tl_cache_read on public.meokseon_tl_cache
  for select to anon, authenticated using (true);   -- 제품 팩트 → 공개 읽기. 쓰기는 service_role 만.

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) scan_history 확장 — loaders.ts 가 기대하는 **컬럼명 그대로**.
--     · scan_id : 기존 PK(id)의 생성 컬럼 별칭. 중복 저장 없음, 항상 id 와 동일.
--     · sodium_color / sugars_color : **스캔 시점의 색 스냅샷**.
--       (먹선 임계가 훗날 바뀌어도 "그때 사용자가 본 색"이 보존됨 → 재현 가능·결정론)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.scan_history
  add column if not exists scan_id      uuid generated always as (id) stored,
  add column if not exists sodium_color text,
  add column if not exists sugars_color text;

comment on column public.scan_history.sodium_color is
  '먹선 traffic_light.nutrients.sodium.color 스냅샷(제품 팩트). null = 판정 없음(≠ 안전).';
comment on column public.scan_history.sugars_color is
  '먹선 traffic_light.nutrients.sugars.color 스냅샷(제품 팩트). null = 판정 없음(≠ 안전).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scan_history_sodium_color_chk') then
    alter table public.scan_history add constraint scan_history_sodium_color_chk
      check (sodium_color is null or sodium_color in ('green','yellow','red'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scan_history_sugars_color_chk') then
    alter table public.scan_history add constraint scan_history_sugars_color_chk
      check (sugars_color is null or sugars_color in ('green','yellow','red'));
  end if;
end $$;

-- loadScans7d 조회 패턴(user_id = ? and scanned_at >= ? and < ? order by scanned_at)은
-- 기존 인덱스 scan_history_user_idx (user_id, scanned_at desc) 가 그대로 커버한다. 추가 인덱스 불필요.

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) BEFORE INSERT 트리거 — 앱 코드 변경 없이 색을 채운다.
--     클라이언트가 색을 보내면(P1-1, 권장) 그 값을 신뢰하고, 안 보내면 캐시에서 보충한다.
--     캐시에도 없으면 null 유지 = "판정 없음"(안전하다고 단정하지 않음 — fail-safe).
--
--     ⚠️ 뷰(VIEW)가 아니라 컬럼인 이유: 조인이 포함된 뷰는 Postgres 에서 auto-updatable 이
--        아니므로 앱의 INSERT into scan_history(scanHistory.ts:124)가 깨진다. INSTEAD OF
--        트리거를 별도로 짜는 건 라이브 테이블의 실패 표면만 늘린다. (IP/136 §4.1)
-- ─────────────────────────────────────────────────────────────────────────────
-- ★ [세션30 정정] IP/136 §4 초안의 트리거에는 **데이터 파괴 버그**가 있었다. 실 Postgres 로 재현·확정.
--    초안: select coalesce(new.sodium_color, c.sodium_color), ... into new.sodium_color, ...
--            from meokseon_tl_cache c where c.barcode = new.barcode;
--    버그: plpgsql 의 SELECT..INTO 는 **매칭 행이 없으면 대상 변수를 NULL 로 덮어쓴다**(coalesce 는
--          no-match 시 평가조차 되지 않는다). 따라서 **캐시 미스 시 클라이언트가 보낸 색이 파괴**된다.
--    영향: 먹선 API 의 traffic_light.nutrients 는 optional 이라 "sodium=red, sugars 판정없음" 이 정상
--          응답이다(IP/136 §1.8). 이때 P1-1 클라이언트가 red 를 보내도 신규 제품(=캐시 미스)이면
--          red 가 NULL 로 소실 → **진짜 나트륨 경고가 사라지고 MS_REPEAT_RED_SODIUM 이 영원히 미발화**.
--          초안 검증이 이를 놓친 이유: 두 색이 모두 non-null 인 케이스만 봤고, 그 경우 if 조건이
--          false 라 트리거가 스킵되어 우연히 통과했다. 파괴는 '부분 결측 + 캐시 미스'에서만 발생하며
--          그것이 신규 제품의 정상 경로다.
--    수정: 조회 결과를 별도 record 에 받고 **found 일 때만** 병합한다. 조회는 1회(성능 동일).
create or replace function public.fill_scan_traffic_light()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hit record;
begin
  if new.barcode is not null and (new.sodium_color is null or new.sugars_color is null) then
    select c.sodium_color, c.sugars_color
      into hit
      from public.meokseon_tl_cache c
     where c.barcode = new.barcode;

    if found then
      -- 클라이언트가 준 값이 항상 우선(그때 사용자가 실제로 본 색). 결측분만 캐시로 보충.
      new.sodium_color := coalesce(new.sodium_color, hit.sodium_color);
      new.sugars_color := coalesce(new.sugars_color, hit.sugars_color);
    end if;
    -- not found → **아무것도 건드리지 않는다.** 클라이언트 값 보존이 최우선.
  end if;
  return new;   -- 캐시 미스여도 INSERT 는 성공(색만 null) — 스캔 저장을 절대 실패시키지 않는다.
end $$;

drop trigger if exists scan_history_fill_tl on public.scan_history;
create trigger scan_history_fill_tl
  before insert on public.scan_history
  for each row execute function public.fill_scan_traffic_light();

-- ─────────────────────────────────────────────────────────────────────────────
-- (4) 되돌리기 (rollback) — 파괴적 변경 없음
-- ─────────────────────────────────────────────────────────────────────────────
-- drop trigger if exists scan_history_fill_tl on public.scan_history;
-- drop function if exists public.fill_scan_traffic_light();
-- alter table public.scan_history drop column if exists scan_id,
--   drop column if exists sodium_color, drop column if exists sugars_color;
-- drop table if exists public.meokseon_tl_cache;
