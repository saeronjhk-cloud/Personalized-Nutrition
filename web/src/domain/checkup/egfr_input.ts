/**
 * 검진 판정 입력에 eGFR 채우기 (순수) — 결과지 eGFR 이 없으면 크레아티닌·성별·나이로 CKD-EPI 2021 추정
 * 판정표 v1.2 결정(제이 10-05): 신장 판정은 eGFR 중심(<60 의료진 상담 권장). 저장은 하지 않음(분석에만 사용).
 * 평가: IP/integration/checkup_ranges_v1_2_eval.md C08·C09
 */
import { resolveEgfr } from "./egfr";

export interface EgfrInputProfile { sex: string | null | undefined; birthYear: number | null | undefined; recordedDate: string | null | undefined; today?: Date }

export function withEgfrInput(input: Record<string, number>, p: EgfrInputProfile): { input: Record<string, number>; derived: boolean } {
  if (typeof input.egfr === "number" && Number.isFinite(input.egfr)) return { input, derived: false };
  if (typeof input.creatinine !== "number" || !Number.isFinite(input.creatinine)) return { input, derived: false };
  const by = p.birthYear;
  const m = /^(\d{4})-/.exec(p.recordedDate ?? "");
  const refYear = m ? Number(m[1]) : (p.today ?? new Date()).getFullYear();
  if (typeof by !== "number" || !Number.isInteger(by) || by < 1900 || by > refYear) return { input, derived: false };
  const sex = p.sex === "M" ? "male" : p.sex === "F" ? "female" : null;
  const r = resolveEgfr({ creatinine: { value: input.creatinine, unit: "mg/dL" } }, refYear - by, sex);
  if (r.value == null) return { input, derived: false };
  return { input: { ...input, egfr: r.value }, derived: true };
}
