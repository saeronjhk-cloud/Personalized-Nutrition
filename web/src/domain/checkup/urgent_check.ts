/**
 * 검진 «신속 확인» 안내 (순수) — 판정 라벨과 별개의 안전 안내. 진단·응급 판정 아님.
 * 기준 정본: IP/schemas/urgent_check_v1.json (이 폴더의 urgent_check_v1.json 은 복사본)
 * 평가: IP/integration/checkup_urgent_check_eval_v1.md U01~U14·W1·W2
 */
import type { CategoryResult } from "./engine";
import spec from "./urgent_check_v1.json";

export interface UrgentRule {
  id: string;
  keys: string[];
  any_gte: Record<string, number>;
  title: string;
  steps: string[];
  emergency: string;
}
export interface UrgentItem {
  id: string;
  title: string;
  values: { key: string; value: number }[];
  steps: string[];
  emergency: string;
}

export const URGENT_RULES: readonly UrgentRule[] = spec.rules as unknown as UrgentRule[];
export const URGENT_FOOTER: string = spec.footer;

export function urgentChecks(results: readonly CategoryResult[]): UrgentItem[] {
  const val = new Map<string, number>();
  for (const r of results) {
    if (typeof r.value === "number" && Number.isFinite(r.value)) val.set(r.biomarker_key, r.value);
  }
  const out: UrgentItem[] = [];
  for (const rule of URGENT_RULES) {
    const hit = Object.entries(rule.any_gte).some(([k, th]) => {
      const v = val.get(k);
      return v !== undefined && v >= th;
    });
    if (!hit) continue;
    const values = rule.keys.filter((k) => val.has(k)).map((k) => ({ key: k, value: val.get(k)! }));
    out.push({ id: rule.id, title: rule.title, values, steps: [...rule.steps], emergency: rule.emergency });
  }
  return out;
}
