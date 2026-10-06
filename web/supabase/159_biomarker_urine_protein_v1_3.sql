-- 159 검진 판정표 v1.3 — 요단백(urine_protein) 추가 · 생성: tools/gen_biomarker_map_v1_3.py
-- 기준: 고시 2026-6호 별표4 별첨(음성 정상A · 약양성 정상B · 양성 이상 질환의심) · 평가: IP/integration/checkup_urine_protein_eval_v1.md
-- 저장 코드: 음성 0 · ± 0.5 · +1~+4 → 1~4 (biomarker_values.value numeric 그대로 — 테이블 구조 변경 없음)
-- 요단백 행만 추가/교체. 기존 18항목은 건드리지 않음. 다시 실행해도 같은 결과.
begin;
insert into public.biomarker_rules (biomarker_key, display_name_ko, unit, category_group, inverted, note, schema_version) values
('urine_protein', '요단백', '', '신장기능', false, '순서 코드 저장: 음성 0 · 약양성(±) 0.5 · 양성 +1~+4 → 1~4. 화면은 기호로 표시.', '1.3.0')
on conflict (biomarker_key) do update set display_name_ko = excluded.display_name_ko, unit = excluded.unit, category_group = excluded.category_group, inverted = excluded.inverted, note = excluded.note, schema_version = excluded.schema_version;
delete from public.biomarker_ranges where biomarker_key = 'urine_protein';
insert into public.biomarker_ranges (biomarker_key, range_min, range_max, level, label_ko, functional_needs, tone, force_medical_referral, sex_specific, sort_order) values
('urine_protein', 0, 0.5, 'normal', '참고범위 내', '{}', '유지', false, null, 1),
('urine_protein', 0.5, 1, 'watch', '참고범위보다 높음', '{}', '관리권장', false, null, 2),
('urine_protein', 1, 99, 'high', '의료진 상담 권장', '{}', '전문가상담권장', true, null, 3);
commit;

-- 확인 ① 행 수(기대: rules 19 · ranges 71)
select (select count(*) from public.biomarker_rules) as rules, (select count(*) from public.biomarker_ranges) as ranges;
-- 확인 ② 요단백 3행(0~0.5 참고범위 내 · 0.5~1 참고범위보다 높음 · 1~99 의료진 상담 권장)
select range_min, range_max, label_ko, force_medical_referral from public.biomarker_ranges where biomarker_key = 'urine_protein' order by range_min;
-- 확인 ③ 틈·겹침 0행
select biomarker_key, sex_specific, range_max, next_min from (select biomarker_key, sex_specific, range_max, lead(range_min) over (partition by biomarker_key, coalesce(sex_specific,'') order by range_min) as next_min from public.biomarker_ranges) t where next_min is not null and next_min <> range_max;
