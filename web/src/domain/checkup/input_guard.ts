/**
 * 검진 입력 가드 (순수) — 사람에게 나올 수 없는 값 · 같은 날짜 중복
 * 판정 기준이 아니라 입력 실수 걸러내기(넓은 범위). 평가: IP/integration/checkup_input_guard_eval_v1.md
 */
export const PLAUSIBLE_BOUNDS: Record<string, readonly [number, number]> = {
  HbA1c: [3, 20],
  fasting_glucose: [20, 800],
  total_cholesterol: [50, 600],
  LDL: [10, 400],
  HDL: [5, 200],
  triglyceride: [10, 5000],
  blood_pressure_systolic: [60, 260],
  blood_pressure_diastolic: [30, 160],
  AST: [3, 5000],
  ALT: [3, 5000],
  GGT: [3, 3000],
  creatinine: [0.1, 20],
  egfr: [2, 200],
  BMI: [10, 70],
  waist: [40, 200],
  hemoglobin: [3, 25],
  TSH: [0.001, 150],
  vitamin_D: [2, 200],
  urine_protein: [0, 4],
};

const URINE_CODES = new Set([0, 0.5, 1, 2, 3, 4]);

const HINT: Record<string, (v: number) => string | null> = {
  BMI: () => "체중(kg)이 아니라 체질량지수예요. 결과지의 ‘체질량지수’ 값을 적어 주세요.",
  fasting_glucose: (v) => (v < 20 ? "mmol/L 로 적으셨다면 18을 곱한 값(mg/dL)을 적어 주세요." : null),
  vitamin_D: (v) => (v > 200 ? "nmol/L 로 적으셨다면 2.5로 나눈 값(ng/mL)을 적어 주세요." : null),
  urine_protein: () => "요단백은 음성(-)·약양성(±)·양성(+1~+4) 중에서 골라 주세요.",
};

export interface ImplausibleItem { key: string; value: number; min: number; max: number; hint: string | null }

export function implausibleValues(input: Record<string, number>): ImplausibleItem[] {
  const out: ImplausibleItem[] = [];
  for (const [key, value] of Object.entries(input)) {
    const b = PLAUSIBLE_BOUNDS[key];
    if (!b || typeof value !== "number" || Number.isNaN(value)) continue;
    const offCode = key === "urine_protein" && !URINE_CODES.has(value);
    if (offCode || value < b[0] || value > b[1]) out.push({ key, value, min: b[0], max: b[1], hint: HINT[key]?.(value) ?? null });
  }
  return out;
}

export function implausibleMessage(it: ImplausibleItem, displayName: string, unit: string): string {
  const base = `${displayName} ${it.value}${unit ? ` ${unit}` : ""} — 보통 ${it.min}~${it.max} 사이 값이에요. 다른 칸이나 단위로 적지 않았는지 확인해 주세요.`;
  return it.hint ? `${base} ${it.hint}` : base;
}

export function sameDateRecord<T extends { id: string; recorded_date: string }>(records: readonly T[], date: string, excludeId?: string): T | null {
  return records.find((r) => r.recorded_date === date && r.id !== excludeId) ?? null;
}

export function sameDateMessage(date: string): string {
  return `${date} 검진 기록이 이미 있어요. 고치려면 기록 관리에서 수정해 주세요.`;
}
