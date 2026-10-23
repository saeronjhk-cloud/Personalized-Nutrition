/**
 * 트랙 B — 영양성분(비타민·무기질) «섭취 부족 가능성 선별» (순수 · 결정론)
 * 명세 IP/integration/nutrient_track_b_v1/00_트랙B_명세_v1_20261023.md · 평가셋 IP/evals/eval_track_b_v1.json
 * 원칙: 고민은 점수·문구에 쓰지 않음 · 같은 원인 그룹은 최댓값만 · 영양소 점수 ≥ 6 · 제품 최대 2 · 카드 우선
 */
import type { SurveyAnswers } from "../../types";
import type { CategoryResult } from "../checkup/engine";

export type NutrientId = "vitamin_d" | "folate" | "iron" | "calcium" | "b12" | "b1" | "vitamin_c";
export type ProductId = "vitamin_d" | "folic_acid" | "iron" | "calcium" | "vitamin_b" | "vitamin_c";
export type LabLevel = "low" | "referral";
export interface TrackBLabs { ferritin?: LabLevel; vitamin_D?: LabLevel }
export interface TrackBProduct { id: ProductId; nutrients: NutrientId[]; score: number; text: string; mfds: string }
export interface TrackBCard { id: "CARE_IRON" | "PRENATAL_IRON" | "MULTI"; text: string }
export interface TrackBResult { products: TrackBProduct[]; cards: TrackBCard[] }

export const THRESHOLD = 6;
export const MAX_PRODUCTS = 2;
export const PRODUCT_ORDER: readonly ProductId[] = ["vitamin_d", "folic_acid", "iron", "calcium", "vitamin_b", "vitamin_c"];
const PRODUCT_OF: Record<NutrientId, ProductId> = {
  vitamin_d: "vitamin_d", folate: "folic_acid", iron: "iron", calcium: "calcium", b12: "vitamin_b", b1: "vitamin_b", vitamin_c: "vitamin_c",
};
const NAME: Record<NutrientId, string> = {
  vitamin_d: "비타민D", folate: "엽산", iron: "철", calcium: "칼슘", b12: "비타민B12", b1: "비타민B1", vitamin_c: "비타민C",
};
/** 식약처 고시 기능성 원문(영양성분) — eval_mfds_function_v1 과 같은 출처 */
const MFDS: Record<NutrientId, string> = {
  vitamin_d: "칼슘과 인이 흡수되고 이용되는데 필요",
  folate: "세포와 혈액생성에 필요",
  iron: "체내 산소운반과 혈액생성에 필요",
  calcium: "뼈와 치아 형성에 필요",
  b12: "정상적인 엽산 대사에 필요",
  b1: "탄수화물과 에너지 대사에 필요",
  vitamin_c: "결합조직 형성과 기능유지에 필요",
};
const MFDS_FOLATE_PREGNANCY = "태아 신경관의 정상 발달에 필요";

export const CARD_TEXT: Record<TrackBCard["id"], string> = {
  CARE_IRON: "철 저장 수치가 낮게 나왔어요. 원인을 먼저 확인하는 것이 좋아서, 철분제를 고르기 전에 의사와 상담해 보세요.",
  PRENATAL_IRON: "임신 중에는 철 필요량이 늘어요. 철분 보충은 산전 검사 결과와 함께 산부인과에서 확인해 보세요.",
  MULTI: "여러 영양소 섭취를 함께 점검해 볼 필요가 있어요. 식사 구성을 먼저 살펴보고, 보충제를 고른다면 지금 드시는 양과 함께 계산하세요.",
};
/** 이유는 명사구로 괄호 안에 « · » 연결 — «~면면» 같은 이어 붙이기 오류 방지 (10-23 화면 확인 중 발견) */
export const PRODUCT_TEXT = "{names} 섭취를 점검해 볼 필요가 있어요({signals}). 식품으로 먼저 채우고, 보충제를 고른다면 지금 드시는 양과 함께 계산하세요.";

interface Hit { score: number; phrase: string | null }
type Groups = Record<string, Hit>;

/** 검진 결과 → 트랙 B 검진 신호 (functional_needs 기준). 중증은 referral */
export function labsFromCheckup(results: readonly CategoryResult[] | null | undefined): TrackBLabs {
  const out: TrackBLabs = {};
  for (const r of results ?? []) {
    const needs = r.functional_needs || [];
    const lv: LabLevel | null = r.force_medical_referral ? "referral" : (r.level === "low" || r.level === "watch") ? "low" : null;
    if (!lv) continue;
    if (needs.includes("철분보충") && out.ferritin !== "referral") out.ferritin = lv;
    if (needs.includes("비타민D보충") && out.vitamin_D !== "referral") out.vitamin_D = lv;
  }
  return out;
}

function put(g: Groups, key: string, score: number, phrase: string | null) {
  if (!g[key] || g[key].score < score) g[key] = { score, phrase };
}

export function trackB(
  a: SurveyAnswers,
  opts: { labs?: TrackBLabs; excludeIds?: readonly string[] } = {},
): TrackBResult {
  const labs = opts.labs ?? {};
  const female = a.성별 === "female";
  const age = typeof a.나이 === "number" ? a.나이 : 0;
  const menses = a.월경상태 === "정상" || a.월경상태 === "불규칙";
  const fertile = female && menses && age >= 19 && age <= 49;
  const meno = female && a.월경상태 === "폐경";
  const pregStage = a.임신단계;
  const pregLegacy = (!pregStage || pregStage === "해당없음") && (a.기저질환 || []).includes("임산부_수유부");
  const pregnant = pregStage === "임신중";
  const vegan = a.채식유형 === "비건";
  const lowMeat = a.육류어패류섭취 === "거의_안함";
  const drugs = a.해당약물 || [];

  const G: Record<NutrientId, Groups> = { vitamin_d: {}, folate: {}, iron: {}, calcium: {}, b12: {}, b1: {}, vitamin_c: {} };
  // 비타민D
  if (a.일조량 === "매우_부족") put(G.vitamin_d, "sun", 6, "거의 실내 생활");
  else if (a.일조량 === "부족") put(G.vitamin_d, "sun", 4, "실내 생활이 많음");
  if (age >= 65) put(G.vitamin_d, "age", 4, "65세 이상");
  if (labs.vitamin_D === "low") put(G.vitamin_d, "lab", 6, "검진 비타민D 수치 낮음");
  // 엽산
  let folateMfds = MFDS.folate;
  if (pregStage === "임신준비" || pregStage === "임신중") { put(G.folate, "preg", 6, "임신 준비·임신 중"); folateMfds = MFDS_FOLATE_PREGNANCY; }
  else if (pregStage === "수유중") put(G.folate, "preg", 4, "수유 중");
  else if (pregLegacy) put(G.folate, "preg", 6, "임신·수유 중");
  // 철
  if (female && menses && a.월경량 === "많음") put(G.iron, "menses", 6, "월경량 많음");
  else if (fertile) put(G.iron, "menses", 2, null);
  if (vegan || lowMeat) put(G.iron, "diet", 4, "고기·생선·달걀을 거의 안 드심");
  if (labs.ferritin === "low" && fertile) put(G.iron, "lab", 6, "검진 철 저장 수치 낮음");
  // 칼슘
  if (a.유제품섭취 === "거의_안함") put(G.calcium, "diet", 4, "우유·유제품을 거의 안 드심");
  if (meno) put(G.calcium, "life", 2, "폐경 이후");
  if (age >= 65) put(G.calcium, "life", 2, "65세 이상");
  // 비타민B12
  if (vegan) put(G.b12, "diet", 6, "완전 채식");
  else if (lowMeat) put(G.b12, "diet", 4, "고기·생선·달걀을 거의 안 드심");
  if (age >= 50) put(G.b12, "age", 2, "50세 이상");
  if (drugs.includes("위산억제제") || drugs.includes("메트포르민")) put(G.b12, "drug", 4, "위산억제제·메트포르민 장기 복용");
  // 비타민B1
  if ((a.음주 === "주3-4회" || a.음주 === "매일") && a.음주량 === "많이") put(G.b1, "alcohol", 6, "술을 자주, 많이 드심");
  // 비타민C
  if (a.채소과일섭취 === "거의_안함") put(G.vitamin_c, "diet", 6, "채소·과일을 거의 안 드심");

  const cards: TrackBCard[] = [];
  if (labs.ferritin === "low" && (!female || a.월경상태 === "폐경")) cards.push({ id: "CARE_IRON", text: CARD_TEXT.CARE_IRON });
  if (pregnant) cards.push({ id: "PRENATAL_IRON", text: CARD_TEXT.PRENATAL_IRON });

  const score = (n: NutrientId) => Object.values(G[n]).reduce((s, h) => s + h.score, 0);
  const candidates = (Object.keys(G) as NutrientId[]).filter((n) => score(n) >= THRESHOLD && !(n === "iron" && pregnant));
  if (candidates.length >= 3) cards.push({ id: "MULTI", text: CARD_TEXT.MULTI });

  const skip = new Set([...(a.현재복용영양제 || []), ...(opts.excludeIds || [])]);
  const byProduct = new Map<ProductId, NutrientId[]>();
  for (const n of candidates) {
    const p = PRODUCT_OF[n];
    if (skip.has(p)) continue;
    byProduct.set(p, [...(byProduct.get(p) || []), n]);
  }
  const products: TrackBProduct[] = [...byProduct.entries()].map(([id, ns]) => {
    const phrases = [...new Set(ns.flatMap((n) => Object.values(G[n]).map((h) => h.phrase).filter((x): x is string => !!x)))];
    const text = PRODUCT_TEXT.replace("{signals}", phrases.join(" · ")).replace("{names}", ns.map((n) => NAME[n]).join("·"));
    const mfds = ns.map((n) => `${ns.length > 1 ? NAME[n] + ": " : ""}${n === "folate" ? folateMfds : MFDS[n]}`).join(" · ");
    return { id, nutrients: ns, score: Math.max(...ns.map(score)), text, mfds };
  });
  products.sort((x, y) => y.score - x.score || PRODUCT_ORDER.indexOf(x.id) - PRODUCT_ORDER.indexOf(y.id));
  return { products: products.slice(0, MAX_PRODUCTS), cards };
}
