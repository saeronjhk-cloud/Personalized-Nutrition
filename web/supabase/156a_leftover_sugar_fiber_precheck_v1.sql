-- 156a · 먹은 양 보정 당류·섬유 — 사전 점검(읽기만, 변경 없음) · 2026-10-04 웹앱트랙
-- 설계 IP/integration/leftover_sugar_fiber_design_v1.md D4 · 평가 B01
-- kind: uniform = 전체 비율(정확 보정) · per_food = 음식별 비율(열량 비율로 근사)
with t as (
  select id, eaten_ratio, leftover_method,
         adjusted_summary a, coalesce(original_summary, summary) o,
         greatest(jsonb_array_length(coalesce(foods, '[]'::jsonb)), 1) n
  from public.meal_log
  where adjusted_summary is not null and not (adjusted_summary ? 'total_sugar_g')
)
select id, leftover_method, round(eaten_ratio, 2) eaten_ratio,
       (o->>'total_calories_kcal')::numeric o_kcal, (a->>'total_calories_kcal')::numeric a_kcal,
       case when abs((a->>'total_calories_kcal')::numeric - (o->>'total_calories_kcal')::numeric * eaten_ratio) <= 0.5 * n + 0.5
            then 'uniform' else 'per_food' end kind,
       (o ? 'total_sugar_g') has_sugar, (o->>'total_sugar_g')::numeric o_sugar, (o->>'total_fiber_g')::numeric o_fiber
from t
order by kind, id;
