/**
 * 건강 변화 리포트 — 검진 비교에 eGFR(크레아티닌 산출) 추가 · 순수 · 결정론(원칙5) · IO import 0
 * 평가: IP/integration/health_report_egfr_eval_v1.md (G01~G14·W1) · 의료 자문 아님
 * 산출식은 egfr.ts(CKD-EPI 2021)·egfr_inputs.ts(프로필 우선) 그대로 재사용. 판정은 기존 classifyChange(구간 기반).
 * 표시 구간 = KDIGO 2012 G1~G5 경계, 정상/관찰 경계는 코칭 EGFR_BLOCK 단일 출처(⬜ 서박사 E4·D4).
 */
import type { Range } from "./engine";
import type { CheckupHistoryRow } from "./timeseries";
import type { CheckupRuleLite } from "./compare";
import { resolveEgfr } from "./egfr";
import { egfrDemographics } from "./egfr_inputs";
import { DEFAULT_GOAL_COACHING_PARAMS } from "../coaching/goal_coaching_params";

export const EGFR_KEY = "egfr";
export const EGFR_RULE: CheckupRuleLite = { biomarker_key: EGFR_KEY, display_name_ko: "eGFR(신장 여과율 추정)", unit: "mL/min/1.73m²" };
const OPEN_MAX = 9999;

export interface EgfrProfileLite { sex: string | null; birth_year: number | null }
export interface DerivedEgfr { rows: CheckupHistoryRow[]; derivedCount: number; sexAssumed: boolean }

/** 측정 egfr 없고 크레아티닌 있는 기록에 산출 eGFR 추가. 입력 불변. 나이·크레아티닌 없거나 산출 불가 → 추가 안 함 */
export function withDerivedEgfr(rows: readonly CheckupHistoryRow[], profile: EgfrProfileLite | null | undefined): DerivedEgfr {
  let derivedCount = 0;
  let sexAssumed = false;
  const out = rows.map((row) => {
    const b = row.biomarkers ?? {};
    if (typeof b[EGFR_KEY] === "number" || typeof b.creatinine !== "number") return { ...row, biomarkers: { ...b } };
    const demo = egfrDemographics({
      profileSex: profile?.sex, profileBirthYear: profile?.birth_year, recordedDate: row.recorded_date,
      surveySex: null, surveySexKnown: false, surveyAge: null,
    });
    if (demo.ageSource !== "profile") return { ...row, biomarkers: { ...b } };
    const r = resolveEgfr({ creatinine: { value: b.creatinine, unit: row.units?.creatinine ?? null } }, demo.age, demo.sex);
    if (r.value == null) return { ...row, biomarkers: { ...b } };
    derivedCount++;
    if (demo.sex == null) sexAssumed = true;
    return { ...row, biomarkers: { ...b, [EGFR_KEY]: r.value } };
  });
  return { rows: out, derivedCount, sexAssumed };
}

/** 표시용 eGFR 구간. block(정상/관찰 경계)은 [45, 90] 로 고정, 폭 0 구간은 만들지 않음 */
export function egfrRanges(block: number = DEFAULT_GOAL_COACHING_PARAMS.EGFR_BLOCK): Range[] {
  const b = Math.min(90, Math.max(45, Number.isFinite(block) ? block : 60));
  const spec: [number, number, string, string, boolean][] = [
    [0, 15, "low", "매우 감소", true],
    [15, 30, "low", "많이 감소", true],
    [30, 45, "low", "중간~많이 감소", false],
    [45, b, "watch", "약간~중간 감소", false],
    [b, 90, "normal", "정상~약간 감소", false],
    [90, OPEN_MAX, "normal", "정상", false],
  ];
  return spec
    .filter(([lo, hi]) => hi > lo)
    .map(([lo, hi, level, label, ref], i) => ({
      id: `egfr_display_${i}`, biomarker_key: EGFR_KEY, range_min: lo, range_max: hi, level, label_ko: label,
      functional_needs: null, tone: null, force_medical_referral: ref, sex_specific: null, sort_order: i,
    }));
}

/** DB 에 egfr 구간·규칙이 없을 때만 표시용 구간·규칙 추가(DB 우선, 중복 0) */
export function withEgfrSupport<R extends CheckupRuleLite>(ranges: readonly Range[], rules: readonly R[], block?: number): { ranges: Range[]; rules: (R | CheckupRuleLite)[] } {
  return {
    ranges: ranges.some((r) => r.biomarker_key === EGFR_KEY) ? [...ranges] : [...ranges, ...egfrRanges(block)],
    rules: rules.some((r) => r.biomarker_key === EGFR_KEY) ? [...rules] : [...rules, EGFR_RULE],
  };
}
