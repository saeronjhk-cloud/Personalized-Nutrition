"""
검진 구간 틈 메우기 v1.1 생성기 — IP/schemas/biomarker_map.json(v1.0) → v1.1 + SQL 157
평가: IP/integration/checkup_range_gap_eval_v1.md (B01~B10)

규칙(유일): 같은 biomarker·같은 성별 묶음에서 range_min 순으로 정렬했을 때
  다음 구간 min > 현재 구간 max 이면 현재 max := 다음 min   (엔진은 min ≤ v < max)
  - min·level·라벨·기능성 필요·tone·상담권장은 **절대 바꾸지 않는다** → v1.0 에서 판정되던 값은 v1.1 에서도 같은 판정.
  - 맨 위·맨 아래 끝(예: 크레아티닌 0.6 미만, 비타민D 100 초과)은 새 판정 기준이라 손대지 않는다(서박사 확인 과제).
출력:
  IP/schemas/biomarker_map_v1.1.json                              (정본)
  web/src/domain/checkup/biomarker_map_v1_1.json                  (코드 저장소 복사본 — 테스트용)
  web/src/domain/checkup/biomarker_map_v1_0.json                  (비교 기준 복사본)
  web/supabase/157_biomarker_ranges_gap_close_v1.sql              (운영 반영)
"""
import copy, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "IP/schemas/biomarker_map.json"
v10 = json.loads(SRC.read_text(encoding="utf-8"))
v11 = copy.deepcopy(v10)
v11["schema_version"] = "1.1.0"
v11["last_updated"] = "2026-10-05"
v11["changelog_1_1_0"] = "구간 사이 틈 제거(max := 다음 min). 엔진 min ≤ v < max 에서 경계·소수 값(공복혈당 99, HbA1c 5.6 등)이 판정 불가가 되던 문제. 기준값·라벨 변경 없음."

changes = []
for key, bm in v11["biomarkers"].items():
    groups = {}
    for i, r in enumerate(bm["ranges"]):
        groups.setdefault(r.get("sex_specific"), []).append(i)
    for sex, idxs in groups.items():
        order = sorted(idxs, key=lambda i: bm["ranges"][i]["min"])
        for a, b in zip(order, order[1:]):
            ra, rb = bm["ranges"][a], bm["ranges"][b]
            if rb["min"] > ra["max"]:
                changes.append({"key": key, "sex": sex, "min": ra["min"], "level": ra["level"], "old_max": ra["max"], "new_max": rb["min"]})
                ra["max"] = rb["min"]
            elif rb["min"] < ra["max"]:
                raise SystemExit(f"겹침 발견 {key} {sex}: {ra} / {rb}")

dump = lambda d: json.dumps(d, ensure_ascii=False, indent=2) + "\n"
(ROOT / "IP/schemas/biomarker_map_v1.1.json").write_text(dump(v11), encoding="utf-8")
(ROOT / "web/src/domain/checkup/biomarker_map_v1_1.json").write_text(dump(v11), encoding="utf-8")
(ROOT / "web/src/domain/checkup/biomarker_map_v1_0.json").write_text(dump(v10), encoding="utf-8")

def num(x):
    return repr(x) if isinstance(x, float) else str(x)

lines = [
    "-- 157 검진 구간 틈 메우기 v1 (biomarker_map v1.0 → v1.1) — 생성: tools/gen_biomarker_map_v1_1.py",
    "-- 평가: IP/integration/checkup_range_gap_eval_v1.md · 엔진 판정식 min ≤ v < max",
    "-- 바뀌는 것: range_max 만(다음 구간 min 으로). min·level·라벨·기능성 필요·상담권장 변경 0. 다시 실행해도 안전(old max 일 때만 갱신).",
    "",
    "-- ① 사전 점검: 바꿀 행 수 (기대 %d)" % len(changes),
    "select count(*) as to_change from public.biomarker_ranges r where " + " or ".join(
        f"(r.biomarker_key='{c['key']}' and coalesce(r.sex_specific,'')='{c['sex'] or ''}' and r.range_min={num(c['min'])} and r.level='{c['level']}' and r.range_max={num(c['old_max'])})"
        for c in changes) + ";",
    "",
    "-- ② 반영",
    "begin;",
]
for c in changes:
    lines.append(
        f"update public.biomarker_ranges set range_max = {num(c['new_max'])} where biomarker_key = '{c['key']}' and coalesce(sex_specific,'') = '{c['sex'] or ''}' and range_min = {num(c['min'])} and level = '{c['level']}' and range_max = {num(c['old_max'])};")
lines += [
    "commit;",
    "",
    "-- ③ 사후 확인: 틈(gap) 0행이어야 함",
    "select biomarker_key, sex_specific, range_max, next_min from (",
    "  select biomarker_key, sex_specific, range_max,",
    "         lead(range_min) over (partition by biomarker_key, coalesce(sex_specific,'') order by range_min) as next_min",
    "  from public.biomarker_ranges) t",
    "where next_min is not null and next_min <> range_max;",
    "",
]
(ROOT / "web/supabase/157_biomarker_ranges_gap_close_v1.sql").write_text("\n".join(lines), encoding="utf-8")
print(len(changes), "changes")
for c in changes: print(c)
