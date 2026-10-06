/**
 * 검진 결과 화면 묶음 (순수) — 엔진 결과(CategoryResult)만 읽어 영역별로 묶는다(새 판정 0)
 * 평가: IP/integration/checkup_result_view_eval_v1.md V01~V08 · v2 T·O(기능성 없는 범위 밖 = 생활관리권장 · 영역 순서 고정)
 * 결정 D2(톤 문구 현행)는 기능성 연결이 있는 항목에 그대로 적용
 */
import type { CategoryResult } from "./engine";
import { resolveToneBody } from "./compliance";

export type ItemStatus = "referral" | "out" | "in" | "unknown";
export interface RuleLite { biomarker_key: string; display_name_ko: string; unit: string; category_group: string }
export interface ViewItem { key: string; name: string; value: number; unit: string; label: string; status: ItemStatus }
export interface ViewSection { area: string; status: ItemStatus; items: ViewItem[]; toneBody: string | null }
export interface ResultView {
  summary: { referral: number; out: number; in: number; unknown: number };
  sections: ViewSection[]; // 상담 → 범위 밖 영역
  inRange: ViewItem[];     // 범위 내만 있는 영역의 항목(접힘)
  unknown: ViewItem[];
}

export const AREA_NAME: Record<string, string> = {
  당대사: "혈당", 지질대사: "콜레스테롤·중성지방", 혈압: "혈압", 간기능: "간 수치", 신장기능: "신장",
  체중관리: "체중·허리둘레", 빈혈: "혈색소", 갑상선: "갑상선", 영양상태: "비타민 D",
};
const RANK: Record<ItemStatus, number> = { referral: 0, out: 1, in: 2, unknown: 3 };
/** 같은 상태 안 영역 순서(고정) — v2 O01~O05 */
export const AREA_ORDER: readonly string[] = [
  "혈당", "콜레스테롤·중성지방", "혈압", "체중·허리둘레", "간 수치", "신장", "혈색소", "갑상선", "비타민 D", "기타",
];
const areaRank = (a: string) => { const i = AREA_ORDER.indexOf(a); return i < 0 ? AREA_ORDER.length : i; };

export function itemStatus(r: CategoryResult): ItemStatus {
  if (r.level === "unknown") return "unknown";
  if (r.force_medical_referral) return "referral";
  return r.level === "normal" ? "in" : "out";
}

export function buildResultView(results: readonly CategoryResult[], rules: readonly RuleLite[]): ResultView {
  const ruleOf = new Map(rules.map((r) => [r.biomarker_key, r]));
  const order = new Map(rules.map((r, i) => [r.biomarker_key, i]));
  const byArea = new Map<string, { items: ViewItem[]; functional: boolean }>();
  const unknown: ViewItem[] = [];
  const summary = { referral: 0, out: 0, in: 0, unknown: 0 };
  const sorted = [...results].sort((a, b) => (order.get(a.biomarker_key) ?? 999) - (order.get(b.biomarker_key) ?? 999));
  for (const r of sorted) {
    const rule = ruleOf.get(r.biomarker_key);
    const status = itemStatus(r);
    summary[status === "in" ? "in" : status] += 1;
    const item: ViewItem = { key: r.biomarker_key, name: rule?.display_name_ko ?? r.biomarker_key, value: r.value, unit: rule?.unit ?? "", label: r.label_ko ?? "판정 기준 없음", status };
    if (status === "unknown") { unknown.push(item); continue; }
    const area = (rule && AREA_NAME[rule.category_group]) ?? "기타";
    const g = byArea.get(area) ?? { items: [], functional: false };
    g.items.push(item);
    if (status === "out" && r.functional_needs.length > 0) g.functional = true;
    byArea.set(area, g);
  }
  const sections: ViewSection[] = [];
  const inRange: ViewItem[] = [];
  const areas = [...byArea.keys()].sort((a, b) => areaRank(a) - areaRank(b));
  for (const area of areas) {
    const g = byArea.get(area)!;
    const items = [...g.items].sort((a, b) => RANK[a.status] - RANK[b.status]);
    const status = items[0].status;
    if (status === "in") { inRange.push(...items); continue; }
    const tone = status === "referral" ? "전문가상담권장" : g.functional ? "관리권장" : "생활관리권장";
    sections.push({ area, status, items, toneBody: resolveToneBody(tone) });
  }
  sections.sort((a, b) => RANK[a.status] - RANK[b.status] || areaRank(a.area) - areaRank(b.area));
  return { summary, sections, inRange, unknown };
}

export const RESULT_DISCLAIMER =
  "이 결과는 입력한 검사값을 공인 참고기준과 비교한 건강정보이며 진단이 아닙니다. 검사기관의 기준, 측정 조건, 복용약 및 개인 상태에 따라 해석이 달라질 수 있습니다. 걱정되는 증상이 있거나 결과가 반복되면 의료진과 상담하세요.";
export const RESULT_SOURCE = "판정 기준: 국가건강검진 판정기준(보건복지부 고시 「건강검진 실시기준」) · 일부 항목은 학회 지침";
