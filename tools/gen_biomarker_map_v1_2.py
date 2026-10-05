"""
검진 판정표 v1.2 생성기 — 국가건강검진 판정기준(복지부 고시 2026-6호 별표4 별첨) 단일 기준
결정(제이 10-05, 외부 자문 1라운드 종합): ① 고시 단일 기준 + 하한·상한 꼬리만 추가 ② 결과-추천 연결 현행 유지
  ③ 라벨 = 렌즈 B(참고범위 내/보다 높음·낮음/의료진 상담 권장, 질병명 금지) ④ 신장 = eGFR 판정(크레아티닌은 고시대로)
매핑: 고시 정상A → normal «참고범위 내»(유지) · 정상B → watch/low «참고범위보다 높음/낮음»(관리권장) · 질환의심 → high/low «의료진 상담 권장»(전문가상담권장, force_medical_referral)
판정식: min ≤ v < max. 고시 «이하» 경계는 다음 유효숫자로(예 AST 40 이하 → <41).
평가: IP/integration/checkup_ranges_v1_2_eval.md (C01~)
출력: IP/schemas/biomarker_map_v1.2.json · web/src/domain/checkup/biomarker_map_v1_2.json · web/supabase/158_biomarker_ranges_v1_2_nhis.sql
"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
v11 = json.loads((ROOT / "IP/schemas/biomarker_map_v1.1.json").read_text(encoding="utf-8"))

NHIS = "보건복지부 고시 건강검진 실시기준 별표4 별첨(2026-6호)"
IN, HI, LO, SLO, REF = "참고범위 내", "참고범위보다 높음", "참고범위보다 낮음", "참고범위보다 약간 낮음", "의료진 상담 권장"

def r(mn, mx, level, label, needs=(), ref=False, sex=None):
    tone = "전문가상담권장" if ref else ("유지" if level == "normal" else "관리권장")
    d = {"min": mn, "max": mx, "level": level, "label_ko": label, "functional_needs": list(needs), "tone": tone}
    if ref: d["force_medical_referral"] = True
    if sex: d["sex_specific"] = sex
    return d

B = {}
def bm(key, name, unit, group, inverted, source, ranges, note=None):
    B[key] = {"display_name_ko": name, "unit": unit, "category_group": group, "inverted": inverted, "note": note, "source": source, "ranges": ranges}

bm("HbA1c", "당화혈색소", "%", "당대사", False, "대한당뇨병학회 진료지침(고시 항목 아님)", [
    r(0, 5.7, "normal", IN), r(5.7, 6.5, "watch", HI, ["혈당조절"]), r(6.5, 99, "high", REF, ["혈당조절"], True)])
bm("fasting_glucose", "공복혈당", "mg/dL", "당대사", False, NHIS + " + 하한 70(대한당뇨병학회 저혈당 기준)", [
    r(0, 70, "low", REF, (), True), r(70, 100, "normal", IN), r(100, 126, "watch", HI, ["혈당조절"]), r(126, 999, "high", REF, ["혈당조절"], True)])
bm("total_cholesterol", "총콜레스테롤", "mg/dL", "지질대사", False, NHIS, [
    r(0, 200, "normal", IN), r(200, 240, "watch", HI, ["콜레스테롤개선"]), r(240, 999, "high", REF, ["콜레스테롤개선"], True)])
bm("LDL", "LDL 콜레스테롤", "mg/dL", "지질대사", False, NHIS, [
    r(0, 130, "normal", IN), r(130, 160, "watch", HI, ["콜레스테롤개선", "혈중중성지방개선"]), r(160, 999, "high", REF, ["콜레스테롤개선"], True)])
bm("HDL", "HDL 콜레스테롤", "mg/dL", "지질대사", True, NHIS, [
    r(0, 40, "low", REF, ["혈행개선"], True), r(40, 60, "watch", LO, ["혈행개선"]), r(60, 999, "normal", IN)], "HDL은 높을수록 좋음 - 역방향 해석")
bm("triglyceride", "중성지방", "mg/dL", "지질대사", False, NHIS, [
    r(0, 150, "normal", IN), r(150, 200, "watch", HI, ["혈중중성지방개선"]), r(200, 9999, "high", REF, ["혈중중성지방개선"], True)])
bm("blood_pressure_systolic", "수축기혈압", "mmHg", "혈압", False, NHIS + " + 하한 90(저혈압 재확인)", [
    r(0, 90, "low", LO), r(90, 120, "normal", IN), r(120, 140, "watch", HI, ["혈압조절"]), r(140, 999, "high", REF, ["혈압조절"], True)])
bm("blood_pressure_diastolic", "이완기혈압", "mmHg", "혈압", False, NHIS + " + 하한 60(저혈압 재확인)", [
    r(0, 60, "low", LO), r(60, 80, "normal", IN), r(80, 90, "watch", HI, ["혈압조절"]), r(90, 999, "high", REF, ["혈압조절"], True)])
bm("AST", "AST (간기능)", "U/L", "간기능", False, NHIS, [
    r(0, 41, "normal", IN), r(41, 51, "watch", HI, ["간건강"]), r(51, 9999, "high", REF, ["간건강"], True)])
bm("ALT", "ALT (간기능)", "U/L", "간기능", False, NHIS, [
    r(0, 36, "normal", IN), r(36, 46, "watch", HI, ["간건강"]), r(46, 9999, "high", REF, ["간건강"], True)])
bm("GGT", "감마GTP", "U/L", "간기능", False, NHIS, [
    r(0, 64, "normal", IN, sex="M"), r(64, 78, "watch", HI, ["간건강"], sex="M"), r(78, 9999, "high", REF, ["간건강"], True, "M"),
    r(0, 36, "normal", IN, sex="F"), r(36, 46, "watch", HI, ["간건강"], sex="F"), r(46, 9999, "high", REF, ["간건강"], True, "F")])
bm("creatinine", "크레아티닌", "mg/dL", "신장기능", False, NHIS + " (신장 판정은 eGFR 중심)", [
    r(0, 1.51, "normal", IN), r(1.51, 999, "high", REF, (), True)], "신장은 기능성 원료 인정 항목 없음 - 추천 비활성")
bm("egfr", "eGFR(신사구체여과율)", "mL/min/1.73m²", "신장기능", True, NHIS + " · 결과지 값 없으면 크레아티닌·성별·나이로 CKD-EPI 2021 추정", [
    r(0, 60, "low", REF, (), True), r(60, 999, "normal", IN)], "높을수록 좋음 - 결과지에 없으면 크레아티닌으로 추정")
bm("BMI", "체질량지수", "kg/m²", "체중관리", False, NHIS, [
    r(0, 18.5, "low", LO), r(18.5, 25, "normal", IN), r(25, 30, "watch", HI, ["체지방감소"]), r(30, 999, "high", REF, ["체지방감소"], True)])
bm("waist", "허리둘레", "cm", "체중관리", False, NHIS, [
    r(0, 90, "normal", IN, sex="M"), r(90, 999, "high", REF, ["체지방감소"], True, "M"),
    r(0, 85, "normal", IN, sex="F"), r(85, 999, "high", REF, ["체지방감소"], True, "F")])
bm("hemoglobin", "혈색소", "g/dL", "빈혈", True, NHIS + " + 상한(외부 자문 A·B: 남 18·여 17 이상 상담)", [
    r(0, 12, "low", REF, ["철분보충"], True, "M"), r(12, 13, "low", SLO, ["철분보충"], sex="M"), r(13, 16.6, "normal", IN, sex="M"),
    r(16.6, 18, "watch", HI, sex="M"), r(18, 99, "high", REF, (), True, "M"),
    r(0, 10, "low", REF, ["철분보충"], True, "F"), r(10, 12, "low", SLO, ["철분보충"], sex="F"), r(12, 15.6, "normal", IN, sex="F"),
    r(15.6, 17, "watch", HI, sex="F"), r(17, 99, "high", REF, (), True, "F")], "low일수록 빈혈")
bm("TSH", "갑상선자극호르몬", "mIU/L", "갑상선", False, "일반 참고범위(고시 항목 아님)", [
    r(0, 0.4, "low", REF, (), True), r(0.4, 4.51, "normal", IN), r(4.51, 999, "high", REF, (), True)], "갑상선은 기능성 원료 인정 항목 없음 - 추천 비활성")
bm("vitamin_D", "비타민 D", "ng/mL", "영양상태", False, "Endocrine Society 지침(고시 항목 아님) · 100 이상 상담(외부 자문 A·B)", [
    r(0, 20, "low", LO, ["비타민D보충"]), r(20, 30, "watch", SLO, ["비타민D보충"]), r(30, 100, "normal", IN), r(100, 999, "high", REF, (), True)])

v12 = {"schema_version": "1.2.0", "last_updated": "2026-10-05",
       "evidence_base": NHIS + " 단일 기준 + 꼬리(저혈당·저혈압·혈색소 상한·비타민D 상한) — IP/integration/검진판정기준_외부자문_회신기록_v1.md",
       "disclaimer_default": "이 결과는 입력한 검사값을 공인 참고기준과 비교한 건강정보이며 진단이 아닙니다.",
       "biomarkers": B, "global_rules": v11["global_rules"]}

dump = lambda d: json.dumps(d, ensure_ascii=False, indent=2) + "\n"
(ROOT / "IP/schemas/biomarker_map_v1.2.json").write_text(dump(v12), encoding="utf-8")
(ROOT / "web/src/domain/checkup/biomarker_map_v1_2.json").write_text(dump(v12), encoding="utf-8")

def q(s): return "null" if s is None else "'" + str(s).replace("'", "''") + "'"
def arr(a): return "'{" + ",".join(a) + "}'"
L = ["-- 158 검진 판정표 v1.2 — 국가건강검진 판정기준(고시 2026-6호) 단일 기준 · 생성: tools/gen_biomarker_map_v1_2.py",
     "-- 평가: IP/integration/checkup_ranges_v1_2_eval.md · 바뀜: 라벨(참고범위 내/높음/낮음/의료진 상담 권장) · AST/ALT/감마GTP/혈색소/BMI/크레아티닌 기준 · 하한·상한 꼬리 · 신규 3항목(이완기혈압·허리둘레·eGFR)",
     "-- 판정 범위 테이블만 교체(사용자 기록·값 무관). 다시 실행해도 같은 결과.",
     "begin;",
     "insert into public.biomarker_rules (biomarker_key, display_name_ko, unit, category_group, inverted, note, schema_version) values"]
L.append(",\n".join(f"({q(k)}, {q(b['display_name_ko'])}, {q(b['unit'])}, {q(b['category_group'])}, {str(b['inverted']).lower()}, {q(b['note'])}, '1.2.0')" for k, b in B.items()))
L.append("on conflict (biomarker_key) do update set display_name_ko = excluded.display_name_ko, unit = excluded.unit, category_group = excluded.category_group, inverted = excluded.inverted, note = excluded.note, schema_version = excluded.schema_version;")
L.append("delete from public.biomarker_ranges where biomarker_key in (" + ", ".join(q(k) for k in B) + ");")
L.append("insert into public.biomarker_ranges (biomarker_key, range_min, range_max, level, label_ko, functional_needs, tone, force_medical_referral, sex_specific, sort_order) values")
rows = []
for k, b in B.items():
    for i, x in enumerate(b["ranges"]):
        rows.append(f"({q(k)}, {x['min']}, {x['max']}, {q(x['level'])}, {q(x['label_ko'])}, {arr(x['functional_needs'])}, {q(x['tone'])}, {str(x.get('force_medical_referral', False)).lower()}, {q(x.get('sex_specific'))}, {i + 1})")
L.append(",\n".join(rows) + ";")
L += ["commit;", "",
      "-- 확인 ① 행 수(기대: 항목 %d · 구간 %d)" % (len(B), len(rows)),
      "select (select count(*) from public.biomarker_rules) as rules, (select count(*) from public.biomarker_ranges) as ranges;",
      "-- 확인 ② 틈·겹침 0행",
      "select biomarker_key, sex_specific, range_max, next_min from (select biomarker_key, sex_specific, range_max, lead(range_min) over (partition by biomarker_key, coalesce(sex_specific,'') order by range_min) as next_min from public.biomarker_ranges) t where next_min is not null and next_min <> range_max;", ""]
(ROOT / "web/supabase/158_biomarker_ranges_v1_2_nhis.sql").write_text("\n".join(L), encoding="utf-8")
print(len(B), "biomarkers", len(rows), "ranges")
