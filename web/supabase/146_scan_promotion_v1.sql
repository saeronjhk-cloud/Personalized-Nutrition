-- =============================================================================
-- 146_scan_promotion_v1.sql
-- 세션31 · 비로그인 스캔 승격(IP/145 §8-2) · 제이 결정: "승격 + 승격시각 기록"
--
-- 적용 대상: **영양공식 Supabase (lrnuqhpgyuizfggxgxpl)**. 136 적용 이후에 건다.
--
-- ── 왜 필요한가 (세션31 실측) ────────────────────────────────────────────────
-- IP/145 §8-2 는 "비로그인 스캔은 localStorage 에만 저장 → 기기 바꾸면 사라진다"고 적었다.
-- **실측 결과 이보다 나쁘다. 기기를 바꾸지 않아도, 로그인하는 순간 사라진다.**
--   scanHistory.ts:203-225 listScans() — 로그인 사용자는 cloud 를 읽는데, cloud 가 **0건이어도**
--   PostgREST 는 data=[] (error=null) 을 준다 → `if (!error && data) return data.map(...)` 이
--   [] 를 리턴하고 **readLocal() 폴백을 타지 않는다.**
--   → 비로그인으로 스캔을 쌓은 사람이 로그인하면 이력이 화면에서 **전부 사라진다.**
--   → 로컬→클라우드 승격 경로는 **코드베이스에 0건**이었다(grep 확인). AuthCallback.tsx:16 의
--     SIGNED_IN 훅은 anon_sessions 링크만 하고 스캔 이력은 건드리지 않는다.
--   → 데이터는 localStorage 에 **아직 살아있다**. 유실이 아니라 **미승격**이므로 복구 가능하다.
-- 패널 온보딩에 직결된다: 패널이 스캔 몇 건 해보고 로그인하면 이력이 사라진 걸 본다.
-- 최악의 첫인상이면서, 동시에 우리가 수집하려던 데이터가 DB 에 들어오지 않는다.
--
-- ── 설계 원칙 ───────────────────────────────────────────────────────────────
--  · scanned_at(스캔 시점) 과 promoted_at(승격 시점)을 **분리**한다.
--    - scanned_at: 사용자가 실제로 스캔한 때. 이력 UI 가 보여주는 값. **동의 이전일 수 있다.**
--    - promoted_at: 서버에 올라온 때 = 로그인 시각. **항상 동의 가능 시점 이후다.**
--    → IP/145 §10-7("동의 이전 스캔 소급 이용 차단 — loadScans7d 에 동의 시점 필터 없음")을
--      해소할 **재료**를 만든다. 이 마이그레이션은 필터를 걸지 않는다(loaders.ts 는 P0 계약).
--      가릴지 말지는 처리방침 확정 시점의 결정이다. 여기서는 **가릴 수 있게만** 해둔다.
--  · 클라이언트를 신뢰하지 않는다. localStorage 는 **사용자가 편집할 수 있다.**
--    - user_id 는 auth.uid() 로 서버가 정한다(클라이언트가 남의 id 를 못 쓴다).
--    - promoted_at 은 now() 로 서버가 정한다. **클라이언트가 못 속인다** → 컴플라이언스 증빙.
--    - scanned_at 은 승격에서만 클라이언트가 보내는 값이다. [now()-400d, now()+1d] 창 밖은
--      **드롭**한다(클램프 아님 — 클램프는 멱등을 깨고 없던 시각을 지어낸다. §3 주석).
--      ★ 이 창은 **보안 통제가 아니다. 그런 척하지 않는다.**
--        MS_REPEAT 를 조작하려면 '최근 7일 안'으로 백데이팅하면 되고 그건 어떤 창이든 통과한다.
--        즉 창은 백데이팅을 막지 못한다. 창의 실제 값어치는 **쓰레기 값 차단**뿐이다
--        (1970 · 2096 · 1e30 같은 값이 DB 에 앉는 것을 막는다).
--        창 안에서의 조작은 **미해결**이며, 자기 데이터로 자기 코칭 카드만 흔드는 것이라
--        현 단계에선 수용한다. 이걸 '방어했다'고 적으면 GI 84(측정한 척한 값)와 같은 거짓말이 된다.
--      ★ 400일인 이유: 90일로 좁히면 **사용자의 오래된 로컬 이력이 로그인 시 실제로 사라진다**
--        (승격에서 드롭 + 로컬은 비워짐 → 화면에서 소실). 어차피 백데이팅을 못 막는 창이라면
--        좁힐 이유가 없고, 좁히면 실사용자 손실만 남는다. 400일 = LOCAL_CAP 50건이 쌓일 수 있는
--        현실적 상한이자 앱 수명보다 길다. 소비자(MS_REPEAT 7일 · 주간리포트 56일)와 무관하다.
--  · 색은 sanitize 한다. 허용 외 값은 **null(판정 없음)로 낙하** — CHECK 위반으로 승격 전체를
--    실패시키지 않는다. null ≠ 안전 doctrine 유지(meokseon.ts:52).
--  · 멱등. 같은 스캔을 두 번 승격해도 1행이다(부분 유니크 인덱스 + on conflict do nothing).
--  · 되돌리기 = §4 블록. 파괴적 변경 없음.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) promoted_at — 승격 시각. null = 처음부터 로그인 상태로 저장된 행(기존 행 전부).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.scan_history
  add column if not exists promoted_at timestamptz;

comment on column public.scan_history.promoted_at is
  '비로그인(localStorage) 스캔이 로그인 시 서버로 승격된 시각. 서버가 now() 로 결정하며 클라이언트가 못 속인다. null = 처음부터 로그인 상태로 저장된 행. scanned_at(스캔 시점)과 구분된다 — scanned_at 은 동의 이전일 수 있으나 promoted_at 은 항상 로그인 이후다(IP/146).';

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) 승격 멱등 보장 — **부분** 유니크 인덱스.
--     ⚠️ 전체 유니크로 걸지 않는 이유: 정상 스캔 경로(saveScan)의 INSERT 를 실패시킬 수 있다.
--        (같은 제품 연타 등) 라이브 쓰기 경로의 실패 표면을 늘리지 않는다.
--        promoted_at is not null = 승격 행에만 적용되므로 기존/정상 경로는 **무영향**이다.
--     로컬은 바코드당 1건으로 dedupe 되므로(scanHistory.ts:131) 이 3튜플이면 충분하다.
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists scan_history_promoted_uniq
  on public.scan_history (user_id, barcode, scanned_at)
  where promoted_at is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) 승격 RPC — 클라이언트가 직접 INSERT 하지 않는 이유가 여기 있다.
--     직접 INSERT 로는 promoted_at 과 scanned_at 을 **클라이언트가 자유롭게 쓴다.**
--     승격은 스캔 시점을 클라이언트가 보내는 **유일한 경로**이므로 서버 검증이 필수다.
--
--     scanned_at_ms: epoch milliseconds(number). ISO 문자열이 아닌 이유 —
--       jsonb_typeof(e->'scanned_at_ms')='number' 로 **try_cast 없이** 쓰레기를 걸러낼 수 있다.
--       (Postgres 에 try_cast 가 없어, ISO 문자열이면 파싱 실패 1건이 승격 전체를 throw 시킨다.
--        그러면 로컬이 안 비워지고 사용자는 **영원히 실패하는 승격**에 갇힌다.)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.promote_local_scans(p_scans jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n   integer;
begin
  if uid is null then
    raise exception '승격에는 인증이 필요합니다' using errcode = '28000';
  end if;
  if p_scans is null or jsonb_typeof(p_scans) <> 'array' then
    return 0;
  end if;
  -- 로컬 상한은 50건(scanHistory.ts LOCAL_CAP). 그 이상은 조작이거나 버그다.
  if jsonb_array_length(p_scans) > 50 then
    raise exception '승격은 최대 50건입니다' using errcode = '22023';
  end if;

  insert into public.scan_history (
    user_id, scanned_at, barcode, product_name, brand, food_category,
    image_url, nutrition, additives, sodium_color, sugars_color, promoted_at)
  select
    uid,                                            -- ★ 서버가 정한다. 클라 값 무시.
    -- scanned_at 은 **클라이언트가 보낸 값 그대로**. 아래 where 절이 창 밖을 이미 걸러냈다.
    to_timestamp(((e->>'scanned_at_ms')::numeric / 1000.0)::double precision),
    e->>'barcode',
    e->>'product_name',
    e->>'brand',
    e->>'food_category',
    e->>'image_url',
    nullif(e->'nutrition', 'null'::jsonb),          -- json null → SQL NULL
    nullif(e->'additives', 'null'::jsonb),
    -- 색 sanitize: 허용 외 값은 null(판정 없음)로 낙하. CHECK 위반으로 전체를 실패시키지 않는다.
    case when e->>'sodium_color' in ('green','yellow','red') then e->>'sodium_color' end,
    case when e->>'sugars_color' in ('green','yellow','red') then e->>'sugars_color' end,
    now()                                           -- ★ 서버가 정한다. 컴플라이언스 증빙.
  from jsonb_array_elements(p_scans) e
  where e->>'barcode' is not null
    -- ★★ [세션31 eval 이 잡은 설계 버그] 초안은 창 밖 값을 **클램프**했다. 두 가지가 틀렸다.
    --   (1) 멱등이 깨진다. 클램프 하한이 now()-90d 인데 now() 는 호출마다 다르다 →
    --       창 밖 스캔은 승격할 때마다 **매번 다른 scanned_at** 으로 앉아 유니크 인덱스를
    --       비켜간다 → 재시도할 때마다 행이 늘어난다. eval E1 이 (1,1,1) 로 재현했다.
    --       이건 부분 실패 후 재시도 경로 = 승격의 **정상 경로**에서 터진다(136 §4 초안과 같은 형태).
    --   (2) 더 나쁜 건, 클램프가 **없던 스캔 시각을 지어낸다.** 2001년 스캔을 창 하한으로
    --       앉히면 그 시각엔 아무 일도 없었다. 우리는 '흰쌀밥 GI 84'(측정한 척한 값) 를
    --       피하려고 GI 트랙을 통째로 다시 짰다. 시각도 같은 종류의 데이터다.
    --   → **클램프하지 않고 드롭한다.** 창 안이면 클라 값 그대로, 밖이면 버린다.
        --     +1일 여유는 클라 시계 오차(skew) 흡수용 — 정상 스캔을 조용히 버리는 게 더 나쁘다.
    --   → 부수효과: **수치 범위 검사가 오버플로 문제를 통째로 흡수한다.** 1e30 은 between 에서
    --     탈락하므로 to_timestamp 가 'timestamp out of range' 로 터질 기회가 없다.
    -- ★ CASE 로 감싼 이유: **WHERE 절 AND 의 평가 순서는 Postgres 가 보장하지 않는다.**
    --   `and jsonb_typeof(...)='number' and (...)::numeric between ...` 로 쓰면 플래너가
    --   비용 기준으로 순서를 바꿀 수 있고, 그러면 scanned_at_ms 가 "어제" 같은 문자열일 때
    --   ::numeric 이 먼저 평가돼 'invalid input syntax for numeric' 로 **승격 전체가 throw** 한다.
    --   → 로컬 1건이 조작/손상되면 그 사용자는 **영원히 실패하는 승격**에 갇힌다.
    --   CASE 는 SQL 표준이 단락평가(short-circuit)를 **보장하는** 유일한 구성이다.
    --   ⚠️ 첫 eval 에서 이 케이스(D1)가 통과했는데, 그건 플래너가 마침 유리하게 정렬한
    --      **우연**이었다(IP/145 §5.1 '우연히 통과' 와 같은 형태). 순서에 기대지 않는다.
    and case
          when jsonb_typeof(e->'scanned_at_ms') = 'number'
          then (e->>'scanned_at_ms')::numeric
                 between extract(epoch from now() - interval '400 days') * 1000
                     and extract(epoch from now() + interval '1 day')   * 1000
          else false
        end
  on conflict (user_id, barcode, scanned_at) where promoted_at is not null
  do nothing;

  get diagnostics n = row_count;
  return n;   -- 실제 삽입된 행 수(중복 스킵분은 제외). 클라이언트 계측용.
end $$;

comment on function public.promote_local_scans(jsonb) is
  '비로그인 localStorage 스캔을 로그인 사용자 행으로 승격. user_id·promoted_at 은 서버가 결정하고 scanned_at 은 [now()-90d, now()] 로 클램프한다. 멱등(부분 유니크 인덱스). 반환값 = 실제 삽입 행 수.';

-- security definer 함수의 기본 public execute 를 회수하고 authenticated 에만 부여.
revoke all on function public.promote_local_scans(jsonb) from public;
grant execute on function public.promote_local_scans(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- (4) 되돌리기 (rollback) — 파괴적 변경 없음
-- ─────────────────────────────────────────────────────────────────────────────
-- drop function if exists public.promote_local_scans(jsonb);
-- drop index if exists public.scan_history_promoted_uniq;
-- alter table public.scan_history drop column if exists promoted_at;
