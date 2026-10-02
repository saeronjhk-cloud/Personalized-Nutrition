/**
 * eGFR 산출 — CKD-EPI 2021 (인종 계수 없음, Inker et al. NEJM 2021) · 순수 · 결정론(원칙5)
 * 평가: IP/integration/egfr_ckd_epi_eval_v1.md (E01~E14) · 의료 자문 아님
 * 배경: 운영 DB 에 biomarker_key 'egfr' 가 없음(10-02 확인) → 크레아티닌으로 산출해 코칭 안전 게이트를 살린다.
 * 측정 eGFR 이 있으면 그것 우선. 성별 미상이면 남·녀 중 낮은 값(보수적). 산출 불가면 null(지어내지 않음).
 */
export type Sex = "male" | "female";

const SCR_MIN = 0.2;
const SCR_MAX = 15;

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** CKD-EPI 2021. scr mg/dL. 범위 밖·성인 아님 → null */
export function ckdEpi2021(scrMgDl: number, age: number, sex: Sex): number | null {
  if (!Number.isFinite(scrMgDl) || scrMgDl < SCR_MIN || scrMgDl > SCR_MAX) return null;
  if (!Number.isFinite(age) || age < 18) return null;
  const female = sex === "female";
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  const r = scrMgDl / k;
  const v = 142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, age) * (female ? 1.012 : 1);
  return round1(v);
}

/** 단위 문자열에 mol 이 있으면 μmol/L → mg/dL */
export function creatinineToMgDl(value: number, unit: string | null | undefined): number {
  return /mol/i.test(unit ?? "") ? value / 88.4 : value;
}

export interface EgfrResolution {
  value: number | null;
  source: "measured" | "ckd_epi_2021" | null;
}

export function resolveEgfr(
  values: Record<string, { value: number; unit?: string | null }> | null | undefined,
  age: number | null,
  sex: unknown,
): EgfrResolution {
  const measured = values?.egfr?.value;
  if (typeof measured === "number" && Number.isFinite(measured) && measured > 0) return { value: measured, source: "measured" };
  const cr = values?.creatinine;
  if (!cr || typeof cr.value !== "number" || age == null) return { value: null, source: null };
  const scr = creatinineToMgDl(cr.value, cr.unit);
  const s: Sex | null = sex === "male" || sex === "female" ? sex : null;
  const cands = (s ? [s] : (["male", "female"] as Sex[])).map((x) => ckdEpi2021(scr, age, x));
  if (cands.some((c) => c == null)) return { value: null, source: null };
  return { value: Math.min(...(cands as number[])), source: "ckd_epi_2021" };
}
