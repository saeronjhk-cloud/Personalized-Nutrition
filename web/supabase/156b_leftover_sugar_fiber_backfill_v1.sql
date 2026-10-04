-- 156b · 먹은 양 보정 당류·섬유 — 기존 행 보정(변경) · 2026-10-04 웹앱트랙
-- ⚠ 엔진·Edge 배포 뒤 실행 · 156a 결과를 Claude 에게 먼저 전달한 뒤 실행
-- 값 = 원본(original_summary ?? summary) 당류·섬유 × eaten_ratio · 소수 1자리
-- ★ uniform(전체 비율) 행만 — per_food(음식별) 행은 열량 비율 근사가 크게 틀릴 수 있어(김밥100%+콜라0% → 실제 4.0g, 근사 22.7g) 제외, 156a 결과 보고 따로 처리
-- adjusted_summary 에 키 2개만 추가(다른 키·컬럼 불변) · 원본에 당류 키가 없는 행은 건드리지 않음
-- meal_log_adjustment(이력)는 그대로 둔다
begin;

with t as (
  select id, eaten_ratio,
         adjusted_summary a, coalesce(original_summary, summary) o,
         greatest(jsonb_array_length(coalesce(foods, '[]'::jsonb)), 1) n
  from public.meal_log
  where adjusted_summary is not null and not (adjusted_summary ? 'total_sugar_g')
    and coalesce(original_summary, summary) ? 'total_sugar_g'
), r as (
  select id, o, eaten_ratio ratio
  from t
  where abs((a->>'total_calories_kcal')::numeric - (o->>'total_calories_kcal')::numeric * eaten_ratio) <= 0.5 * n + 0.5
)
update public.meal_log m
set adjusted_summary = m.adjusted_summary
  || jsonb_build_object('total_sugar_g', round(coalesce((r.o->>'total_sugar_g')::numeric, 0) * r.ratio, 1))
  || case when r.o ? 'total_fiber_g'
          then jsonb_build_object('total_fiber_g', round(coalesce((r.o->>'total_fiber_g')::numeric, 0) * r.ratio, 1))
          else '{}'::jsonb end
from r
where m.id = r.id;

-- 확인(B03): with_sugar = total − (156a 의 per_food 행 수 + has_sugar=false 행 수)
select count(*) filter (where adjusted_summary ? 'total_sugar_g') with_sugar, count(*) total
from public.meal_log where adjusted_summary is not null;

commit;
