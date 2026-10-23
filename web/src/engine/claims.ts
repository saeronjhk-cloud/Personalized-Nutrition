/**
 * 인정 기능성 → 추천 가능한 고민 카테고리 (H150 · 제이 10-23 P1·P3·P4)
 * 정본 IP/evals/eval_claim_categories_v1.json — 이 폴더의 claim_categories_v1.json 은 복사본(수정은 정본 먼저).
 * 표에 없는 원료·cats 가 빈 원료는 추천하지 않는다(fail-closed).
 */
import RAW from "./claim_categories_v1.json";

export type SexScope = "all" | "female" | "male";
export interface Claim {
  cats: Record<string, SexScope>;
  basis: string;
  sex?: "male" | "female";
  weights?: Record<string, number>;
  condition?: { id: string; score: number };
}
export const CLAIMS: Readonly<Record<string, Claim>> = (RAW as unknown as { claims: Record<string, Claim> }).claims;

/** 이 사람(성별)에게 허용된 카테고리. 성별 모름이면 성별 한정 카테고리는 제외 */
export function allowedCategories(id: string, sex: string | null | undefined): Set<string> {
  const c = CLAIMS[id];
  const out = new Set<string>();
  if (!c) return out;
  if (c.sex && c.sex !== sex) return out;
  for (const [cat, scope] of Object.entries(c.cats)) if (scope === "all" || scope === sex) out.add(cat);
  return out;
}
