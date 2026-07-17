-- =============================================================================
-- 147_d1_seam_v1.sql — D-1 이음매: 오케스트레이터 계약 ↔ 영양공식 실스키마
-- 세션31 · 적용 대상: **영양공식 Supabase (lrnuqhpgyuizfggxgxpl)**
--
-- ── 선행 조건 (반드시 먼저) ─────────────────────────────────────────────────
-- myhealthcheck 의 마이그레이션 3개를 이 프로젝트에 먼저 적용한다. 전부 멱등이다.
--   1) 20260714120000_p0_orchestrator.sql   reason_code_registry·action_candidates
--                                           ·orchestrator_decisions·action_events + 레지스트리 시드
--   2) 20260714130000_orchestrator_loader_seam.sql  profiles.timezone · user_safety_profiles
--   3) 20260714140000_safety_profile_onboarding.sql user_safety_profiles 확장 + 동의 함수
-- ★ 그 3개를 여기 복사하지 않는다. 정본은 myhealthcheck 에 있고 사본을 뜨면 표류한다
--   (GI 표 사본이 정본을 가린 세션30 사고와 같은 형태 — IP/145 §5.3).
--
-- ── 이 파일이 하는 일 ───────────────────────────────────────────────────────
-- IP/145 §2 는 D-1 을 "✅ 완료"로 적었으나 세션31 실측 결과 **오케스트레이터는 이 프로젝트에서
-- 한 번도 돈 적이 없다**(출력 4테이블 전무). 그리고 더 근본적으로 —
-- **loaders.ts 의 계약이 Vita50 스키마를 가리킨다.**
--   loaders.ts:164 주석: "public.meals 행 (확인된 실 컬럼)"  ← Vita50 DB 에서 확인한 것이다.
--   영양공식엔 meals 도 characters 도 없다. meal_log(24컬럼)·survey_responses 가 있다.
--
-- → **읽기 전용 뷰로 화해시킨다. loaders.ts 무수정.**
--   IP/136 이 scan_id 생성컬럼으로 쓴 것과 같은 수법이다.
--   136 이 뷰를 피한 이유("조인 뷰는 auto-updatable 이 아니라 앱의 INSERT 가 깨진다")는
--   여기 해당 없다 — 앱은 meal_log 에 쓰고 오케스트레이터는 meals 를 **읽기만** 한다.
--
-- ── 이 파일이 하지 못하는 일 (정직하게) ────────────────────────────────────
-- 뷰는 **없는 데이터를 만들지 못한다.** 세션31 실측:
--   · foods[].gi / gi_source  — nutrilens.ts:11 MealFood 에 **없다**. computeMealGL 이 gl 을
--     못 만들고 → NL_DINNER_HIGH_GL 영구 미발화. 해소 = IP/145 §9-1(GI 엔진 NutriLens 승격).
--   · target_protein_g        — toNutriMeal 이 채우지 않는다 → NL_LOW_PROTEIN_MEAL 미발화.
--                               해소 = IP/145 §11-4(서박사 임상값) + loaders 배선.
--   · liquid_sugar_g          — 어느 계층에도 없다 → NL_LIQUID_SUGAR 미발화.
-- 즉 **이 마이그레이션만으로는 카드가 뜨지 않는다.** 엔진이 42P01 없이 돌고, 후보가 쌓이고,
-- 위 구멍이 진단(loader diag)으로 남는 상태까지가 이 파일의 범위다.
-- 현재 유일하게 살아있는 카드 경로 = MS_REPEAT_RED_SODIUM(태그 요구 [] → 프로파일 불요).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) meals — meal_log 위의 읽기 전용 뷰. loaders.ts:401 의 select 계약 그대로.
--     계약: id, eaten_at, meal_type, est_carbs_g, est_protein_g, est_fat_g, est_kcal,
--           foods, source  (+ user_id 필터 · eaten_at 범위 · order · limit)
--
--     ★ security_invoker = true 가 **필수**다.
--       뷰는 기본적으로 소유자 권한으로 돈다 → RLS 를 우회한다 → 이 뷰가 없으면
--       **모든 사용자의 식사가 아무 authenticated 에게 노출된다.**
--       loaders 가 .eq('user_id', …) 로 거른다고 안전한 게 아니다 — 그건 호출자의 선의일 뿐이고
--       뷰 자체가 열려 있으면 누구든 직접 조회할 수 있다. invoker 로 meal_log 의 RLS 를 상속한다.
--       (PostgreSQL 15+ 필요. Supabase 는 15+ 다.)
-- ─────────────────────────────────────────────────────────────────────────────
drop view if exists public.meals;
create view public.meals
with (security_invoker = true)
as
select
  ml.id,
  ml.user_id,
  ml.eaten_at,
  -- 이름만 다르다. 값 도메인은 동일('breakfast'|'lunch'|'dinner'|'snack'|null).
  ml.meal_slot as meal_type,
  -- ★ 실섭취 우선. 우리 코드의 확립된 도크트린이다(web/src/domain/unified/meal_diet_bridge.ts:7,43
  --   "잔반 보정된 실섭취(adjusted_summary)를 우선 사용, 없으면 원본 summary").
  --   추측이 아니라 인용이다. 오케스트레이터는 **차린 양이 아니라 먹은 양**을 봐야 한다.
  -- ★ jsonb_typeof 가드: ->> 는 text 를 주고 ::numeric 은 숫자가 아니면 **throw** 한다.
  --   뷰에서 throw 하면 한 행이 아니라 **loadMeals 전체 쿼리가 죽는다.** 한 행의 오염이
  --   그날 식사 전부를 지우게 둘 수 없다 → 숫자가 아니면 null(= 미상, 안전 아님).
  case when jsonb_typeof(coalesce(ml.adjusted_summary, ml.summary) -> 'total_carbs_g') = 'number'
       then (coalesce(ml.adjusted_summary, ml.summary) ->> 'total_carbs_g')::numeric end     as est_carbs_g,
  case when jsonb_typeof(coalesce(ml.adjusted_summary, ml.summary) -> 'total_protein_g') = 'number'
       then (coalesce(ml.adjusted_summary, ml.summary) ->> 'total_protein_g')::numeric end   as est_protein_g,
  case when jsonb_typeof(coalesce(ml.adjusted_summary, ml.summary) -> 'total_fat_g') = 'number'
       then (coalesce(ml.adjusted_summary, ml.summary) ->> 'total_fat_g')::numeric end       as est_fat_g,
  case when jsonb_typeof(coalesce(ml.adjusted_summary, ml.summary) -> 'total_calories_kcal') = 'number'
       then (coalesce(ml.adjusted_summary, ml.summary) ->> 'total_calories_kcal')::numeric end as est_kcal,
  -- foods 는 그대로 넘긴다. ⚠️ MealFood(nutrilens.ts:11)엔 gi·gi_source 가 없다 →
  --   computeMealGL 은 gl 을 만들지 못한다. 뷰가 메울 수 있는 문제가 아니다(§9-1).
  ml.foods,
  ml.source
from public.meal_log ml;

comment on view public.meals is
  'D-1 이음매: 오케스트레이터 loaders.ts 의 meals 계약을 영양공식 meal_log 로 매핑하는 읽기 전용 뷰. security_invoker=true 로 meal_log 의 RLS 를 상속한다. est_* 는 coalesce(adjusted_summary, summary) 의 total_* 에서 뽑는다(실섭취 우선 — meal_diet_bridge.ts:7). ⚠️ foods[].gi 는 원천에 없어 NL_DINNER_HIGH_GL 은 이 뷰로 살아나지 않는다(IP/145 §9-1).';

grant select on public.meals to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) characters — survey_responses 위의 읽기 전용 뷰. loaders.ts:377 계약.
--     계약: .select('goals').eq('user_id', …).maybeSingle()
--
--     ★ maybeSingle() 은 **0 또는 1행**을 요구한다. 2행 이상이면 PGRST116 으로 **에러**다.
--       survey_responses 는 이력 테이블이라 사용자당 여러 행이다 → distinct on 으로 최신 1행.
--     ★ deleted_at 이 있는 소프트삭제 행은 제외한다. 삭제한 설문의 목표를 코칭에 쓰면 안 된다.
-- ─────────────────────────────────────────────────────────────────────────────
drop view if exists public.characters;
create view public.characters
with (security_invoker = true)
as
select distinct on (sr.user_id)
  sr.user_id,
  sr.goals
from public.survey_responses sr
where sr.deleted_at is null
order by sr.user_id, sr.created_at desc;   -- 사용자당 최신 설문 1행 (maybeSingle 계약)

comment on view public.characters is
  'D-1 이음매: 오케스트레이터 loaders.ts 의 characters.goals 계약을 영양공식 survey_responses 로 매핑. 사용자당 최신 1행(maybeSingle 계약 — 2행이면 PGRST116). deleted_at 행 제외. security_invoker=true.';

grant select on public.characters to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) 되돌리기 — 파괴적 변경 없음(뷰만 만든다. 원천 테이블 무접촉)
-- ─────────────────────────────────────────────────────────────────────────────
-- drop view if exists public.meals;
-- drop view if exists public.characters;
