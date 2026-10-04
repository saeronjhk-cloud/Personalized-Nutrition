-- 156c · 먹은 양 보정 당류·섬유 — 음식별(per_food) 보정 2건 정확 보정 · 2026-10-04 웹앱트랙
-- 방법: 각 음식 원래 영양 × 음식별 비율(0~1, 5% 단위) 중 저장된 5개 합계(열량·단백질·탄수·지방·나트륨)와
--       반올림까지 일치하는 조합을 전수 탐색 → 두 건 모두 해가 «유일», 비율 평균이 eaten_ratio 와 일치(검증)
--   eb7a16b8: 새우 파스타 20% · 비프 스튜와 빵 100% (평균 0.60 ✓) → 당 8.8×0.2+3×1 = 4.8 · 섬유 5.2×0.2+1.6 = 2.6
--   60a9119d: 감자튀김 65% · 새우 샐러드 100% · 나초 85% · 치킨 윙 85% · 과카몰리 90% (평균 0.85 ✓) → 당 8.1 · 섬유 13.6
-- 이미 당류 키가 있으면 건드리지 않음(재실행 안전)
begin;
update public.meal_log set adjusted_summary = adjusted_summary || '{"total_sugar_g": 4.8, "total_fiber_g": 2.6}'::jsonb
where id = 'eb7a16b8-bbda-4e94-91b3-f8ba6c759320' and not (adjusted_summary ? 'total_sugar_g');
update public.meal_log set adjusted_summary = adjusted_summary || '{"total_sugar_g": 8.1, "total_fiber_g": 13.6}'::jsonb
where id = '60a9119d-e664-48d1-8203-4c0601eb529d' and not (adjusted_summary ? 'total_sugar_g');
-- 확인: with_sugar = total (21 = 21)
select count(*) filter (where adjusted_summary ? 'total_sugar_g') with_sugar, count(*) total
from public.meal_log where adjusted_summary is not null;
commit;
