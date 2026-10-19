/**
 * 합계 점검 v0 입력 모델(순수) — 지금 드시는 영양제 중 계산 대상 제품별 입력 칸 + 저장값 → DoseEntry 평탄화.
 * 저장은 lib/suppDoseStore.ts(기기 안 localStorage, 서버 0).
 */
import type { DoseEntry, DoseUnit, UlNutrientId } from "./ul_check";
import { UL_LABEL } from "./ul_check";

export interface DoseField { n: UlNutrientId; label: string; units: readonly DoseUnit[] }

const F = (n: UlNutrientId, units: readonly DoseUnit[] = ["mg"]): DoseField => ({
  n, label: n === "folic_acid" ? "합성 엽산(보충제·강화식품)" : UL_LABEL[n].name, units,
});

/** 제품(설문 현재 복용 영양제 id) → 입력 칸. 종합비타민은 8성분 중 아는 것만 */
export const DOSE_PRODUCTS: readonly { id: string; label: string; fields: readonly DoseField[] }[] = [
  { id: "multivitamin", label: "종합비타민", fields: [
    F("vitamin_d", ["μg", "IU"]), F("calcium"), F("iron"), F("zinc"), F("vitamin_b6"), F("vitamin_c"), F("magnesium"), F("folic_acid", ["μg", "μg DFE"]),
  ] },
  { id: "vitamin_d", label: "비타민D", fields: [F("vitamin_d", ["μg", "IU"])] },
  { id: "calcium", label: "칼슘", fields: [F("calcium")] },
  { id: "iron", label: "철분", fields: [F("iron")] },
  { id: "magnesium", label: "마그네슘", fields: [F("magnesium")] },
  { id: "vitamin_c", label: "비타민C", fields: [F("vitamin_c")] },
];

export type DoseValue = { v: string; u: DoseUnit };
export type DoseStore = Record<string, Partial<Record<UlNutrientId, DoseValue>>>;

const UNITS: readonly DoseUnit[] = ["mg", "μg", "IU", "μg DFE"];

/** 손상·옛 형식에 강하게 — 알 수 없는 값은 버린다 */
export function parseDoseStore(raw: string | null | undefined): DoseStore {
  let j: unknown;
  try { j = JSON.parse(raw || "{}"); } catch { return {}; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return {};
  const out: DoseStore = {};
  for (const p of DOSE_PRODUCTS) {
    const rec = (j as Record<string, unknown>)[p.id];
    if (!rec || typeof rec !== "object") continue;
    for (const f of p.fields) {
      const d = (rec as Record<string, unknown>)[f.n] as { v?: unknown; u?: unknown } | undefined;
      if (!d || typeof d.v !== "string" || !UNITS.includes(d.u as DoseUnit) || !f.units.includes(d.u as DoseUnit)) continue;
      (out[p.id] ??= {})[f.n] = { v: d.v, u: d.u as DoseUnit };
    }
  }
  return out;
}

/** 지금 드시는 제품만 계산에 넣는다(목록에서 빠진 제품의 예전 입력은 무시) */
export function dosesFor(store: DoseStore, current: readonly string[]): DoseEntry[] {
  const cur = new Set(current);
  const out: DoseEntry[] = [];
  for (const p of DOSE_PRODUCTS) {
    if (!cur.has(p.id)) continue;
    for (const f of p.fields) {
      const d = store[p.id]?.[f.n];
      if (d) out.push({ n: f.n, v: d.v, u: d.u });
    }
  }
  return out;
}

export function doseProductsFor(current: readonly string[]) {
  const cur = new Set(current);
  return DOSE_PRODUCTS.filter((p) => cur.has(p.id));
}
