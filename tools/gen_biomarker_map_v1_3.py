"""
검진 판정표 v1.3 생성기 — v1.2(국가검진 고시 단일 기준) + 요단백(urine_protein) 1항목 추가
기준: 고시 별표4 별첨 신장질환 — 요단백 정상A 음성(-) / 정상B 약양성(±) / 질환의심 양성(+1) 이상
저장 코드(순서형): 음성 0 · ± 0.5 · +1 1 · +2 2 · +3 3 · +4 4 (web/src/domain/checkup/urine_protein.ts 와 일치)
평가: IP/integration/checkup_urine_protein_eval_v1.md
출력: IP/schemas/biomarker_map_v1.3.json · web/src/domain/checkup/biomarker_map_v1_3.json · web/supabase/159_biomarker_urine_protein_v1_3.sql
"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
v12 = json.loads((ROOT / "IP/schemas/biomarker_map_v1.2.json").read_text(encoding="utf-8"))
NHIS = "보건복지부 고시 건강검진 실시기준 별표4 별첨(2026-6호)"

UP = {"display_name_ko": "요단백", "unit": "", "category_group": "신장기능", "inverted": False,
      "note": "순서 코드 저장: 음성 0 · 약양성(±) 0.5 · 양성 +1~+4 → 1~4. 화면은 기호로 표시.",
      "source": NHIS + " (정상A 음성 · 정상B 약양성 · 질환의심 양성 이상)",
      "ranges": [
          {"min": 0, "max": 0.5, "level": "normal", "label_ko": "참고범위 내", "functional_needs": [], "tone": "유지"},
          {"min": 0.5, "max": 1, "level": "watch", "label_ko": "참고범위보다 높음", "functional_needs": [], "tone": "관리권장"},
          {"min": 1, "max": 99, "level": "high", "label_ko": "의료진 상담 권장", "functional_needs": [], "tone": "전문가상담권장", "force_medical_referral": True},
      ]}

B = {}
for k, b in v12["biomarkers"].items():
    B[k] = b
    if k == "egfr":
        B["urine_protein"] = UP

v13 = dict(v12)
v13["schema_version"] = "1.3.0"
v13["last_updated"] = "2026-10-06"
v13["biomarkers"] = B

dump = lambda d: json.dumps(d, ensure_ascii=False, indent=2) + "\n"
(ROOT / "IP/schemas/biomarker_map_v1.3.json").write_text(dump(v13), encoding="utf-8")
(ROOT / "web/src/domain/checkup/biomarker_map_v1_3.json").write_text(dump(v13), encoding="utf-8")

def q(s): return "null" if s is None else "'" + str(s).replace("'", "''") + "'"
def arr(a): return "'{" + ",".join(a) + "}'"
b = UP
L = ["-- 159 검진 판정표 v1.3 — 요단백(urine_protein) 추가 · 생성: tools/gen_biomarker_map_v1_3.py",
     "-- 기준: 고시 2026-6호 별표4 별첨(음성 정상A · 약양성 정상B · 양성 이상 질환의심) · 평가: IP/integration/checkup_urine_protein_eval_v1.md",
     "-- 저장 코드: 음성 0 · ± 0.5 · +1~+4 → 1~4 (biomarker_values.value numeric 그대로 — 테이블 구조 변경 없음)",
     "-- 요단백 행만 추가/교체. 기존 18항목은 건드리지 않음. 다시 실행해도 같은 결과.",
     "begin;",
     "insert into public.biomarker_rules (biomarker_key, display_name_ko, unit, category_group, inverted, note, schema_version) values",
     f"('urine_protein', {q(b['display_name_ko'])}, {q(b['unit'])}, {q(b['category_group'])}, false, {q(b['note'])}, '1.3.0')",
     "on conflict (biomarker_key) do update set display_name_ko = excluded.display_name_ko, unit = excluded.unit, category_group = excluded.category_group, inverted = excluded.inverted, note = excluded.note, schema_version = excluded.schema_version;",
     "delete from public.biomarker_ranges where biomarker_key = 'urine_protein';",
     "insert into public.biomarker_ranges (biomarker_key, range_min, range_max, level, label_ko, functional_needs, tone, force_medical_referral, sex_specific, sort_order) values"]
rows = [f"('urine_protein', {x['min']}, {x['max']}, {q(x['level'])}, {q(x['label_ko'])}, {arr(x['functional_needs'])}, {q(x['tone'])}, {str(x.get('force_medical_referral', False)).lower()}, null, {i + 1})" for i, x in enumerate(b["ranges"])]
L.append(",\n".join(rows) + ";")
L += ["commit;", "",
      "-- 확인 ① 행 수(기대: rules 19 · ranges 71)",
      "select (select count(*) from public.biomarker_rules) as rules, (select count(*) from public.biomarker_ranges) as ranges;",
      "-- 확인 ② 요단백 3행(0~0.5 참고범위 내 · 0.5~1 참고범위보다 높음 · 1~99 의료진 상담 권장)",
      "select range_min, range_max, label_ko, force_medical_referral from public.biomarker_ranges where biomarker_key = 'urine_protein' order by range_min;",
      "-- 확인 ③ 틈·겹침 0행",
      "select biomarker_key, sex_specific, range_max, next_min from (select biomarker_key, sex_specific, range_max, lead(range_min) over (partition by biomarker_key, coalesce(sex_specific,'') order by range_min) as next_min from public.biomarker_ranges) t where next_min is not null and next_min <> range_max;", ""]
(ROOT / "web/supabase/159_biomarker_urine_protein_v1_3.sql").write_text("\n".join(L), encoding="utf-8")
print(len(B), "biomarkers")
