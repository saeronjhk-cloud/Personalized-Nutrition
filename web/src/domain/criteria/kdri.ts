/**
 * 영양 기준 버전 표 (H134) — 수치는 여기서만. 새 판이 나오면 이 파일 + 평가셋만 교체.
 * 정본: IP/integration/kdri2025_v1/00_KDRI2025_상한섭취량_확인표_20261018.md · 10_kdri2025_criteria_v0.json
 * 원문: 2025 한국인 영양소 섭취기준(보건복지부·한국영양학회, 공개 2025-12-31, 정오표 1~3차 적용판 — UL·CDRR 수치 정오 없음)
 * 평가셋: IP/evals/eval_kdri2025_v1.json (K01~)
 */
export const KDRI_VERSION = "KDRI-2025" as const;

/** 나트륨 만성질환위험감소섭취량(CDRR, UL 아님) mg/일 — 12-64세 2,300 · 65-74세 1,900 · 75세 이상 1,800 (임신·수유 2,300) */
export function sodiumCdrrMg(age: number | null | undefined): number {
  const a = age ?? 0;
  if (a >= 75) return 1800;
  if (a >= 65) return 1900;
  return 2300;
}

/** 식이섬유 충분섭취량 g/일 — 원문 확인분만: 남 19-64 30 · 여 19-49 20 · 여 50+ 25. 남 65+ 는 미확인 → null(신호 생략) */
export function fiberAiG(sex: string | null | undefined, age: number | null | undefined): number | null {
  const a = age ?? 30;
  if (sex === "female") return a >= 50 ? 25 : 20;
  return a >= 65 ? null : 30;
}

/** 단백질 성인 평균필요량 0.73 g/kg → 권장섭취량 ≈0.91 g/kg(변이계수 12.5%) — 2020 과 동일 */
export const PROTEIN_RNI_G_PER_KG = 0.91;
/** 총당류: 총 에너지의 20% 이내 */
export const SUGAR_MAX_ENERGY_RATIO = 0.2;

export type UlScope = "total" | "non_food_only" | "synthetic_only";
export interface UlEntry { id: string; name: string; unit: "mg" | "μg"; scope: UlScope; ul: (sex: string | null | undefined, age: number | null | undefined) => number }

/** 상한섭취량(UL) v0 8성분 — 성인(19세 이상)만. 임신·수유는 같은 나이 여성 값(칼슘)·나머지 동일 */
export const UL_V0: readonly UlEntry[] = [
  { id: "vitamin_d", name: "비타민D", unit: "μg", scope: "total", ul: () => 100 },
  { id: "calcium", name: "칼슘", unit: "mg", scope: "total", ul: (s, a) => (s === "female" ? ((a ?? 30) >= 30 ? 2000 : 2500) : ((a ?? 30) < 30 ? 3000 : 2500)) },
  { id: "iron", name: "철", unit: "mg", scope: "total", ul: () => 45 },
  { id: "zinc", name: "아연", unit: "mg", scope: "total", ul: () => 35 },
  { id: "vitamin_b6", name: "비타민B6", unit: "mg", scope: "total", ul: () => 50 },
  { id: "vitamin_c", name: "비타민C", unit: "mg", scope: "total", ul: () => 2000 },
  { id: "magnesium", name: "마그네슘", unit: "mg", scope: "non_food_only", ul: () => 350 },
  { id: "folic_acid", name: "엽산(합성)", unit: "μg", scope: "synthetic_only", ul: () => 1000 },
];
