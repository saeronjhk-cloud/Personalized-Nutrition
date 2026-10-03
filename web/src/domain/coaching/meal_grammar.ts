/**
 * 한식 끼니 문법 P1 — 끼니 판정 · 규칙 G-PRO/G-VEG/G-AM · 사진 검증 루프 (순수 · 결정론 · 원칙5)
 *
 * 설계: IP/integration/meal_grammar_p1_design_v1.md · 평가: IP/integration/meal_grammar_p1_eval_v1.md (G·V)
 * 상위: IP/SUH_LOOP_v3_차별화코칭로직_설계안_v1.md §3 L1·L3 · §5 P1
 * - g·kcal 을 쓰지 않는다(있다/없다만). 모르면 «미상»(null) — 미상 ≠ 없음.
 * - 하루 카드 1장(활성) + «유지 중» 1줄. 병목 선택기(P2) 전까지 고정 순서.
 * ⚠ IO import 금지(W3). 안전 게이트 값은 v1 파라미터(goal_coaching_params)를 재사용한다(단일 출처).
 */
import { resolveRoles, type Role } from "./meal_role";
import { DEFAULT_MEAL_GRAMMAR_PARAMS, type GrammarRuleId, type MealGrammarParams } from "./meal_grammar_params";
import { DEFAULT_GOAL_COACHING_PARAMS } from "./goal_coaching_params";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
const MAIN_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식" };

export type Tri = true | false | null;

// ── 입력 ────────────────────────────────────────────────────────────────────
export interface GrammarMealRow {
  eaten_at: string;
  meal_slot: string | null;
  foods: unknown;
}

export interface GrammarMeal {
  /** 로컬 날짜 YYYY-MM-DD */
  day: string;
  slot: MealSlot;
  names: string[];
}

export interface JudgedMeal extends GrammarMeal {
  staple: Tri;
  protein: Tri;
  veg: Tri;
}

export interface MealGrammarInput {
  mealEnabled: boolean;
  loggedIn: boolean;
  rows: readonly GrammarMealRow[];
  now: Date;
  conditions: readonly string[];
  egfr: number | null;
  /** v1 단백질 카드(근육증가 g 기반)가 오늘 보이면 true → G-PRO·G-AM 중복 금지(설계 §5-4) */
  v1CardVisible: boolean;
  params?: MealGrammarParams;
}

// ── 출력 ────────────────────────────────────────────────────────────────────
export interface RuleStat { opps: number; success: number; graduated: boolean }

export interface GrammarCard {
  rule: GrammarRuleId;
  slots: MealSlot[];
  text: string;
  why: string;
  evidence: { success: number; opps: number };
  evidence_text: string | null;
}

export interface MaintenanceLine { rule: GrammarRuleId; success: number; opps: number; text: string }

export type GrammarBlockedReason = "kidney_condition" | "egfr_low";

export interface MealGrammarResult {
  active: GrammarCard | null;
  maintenance: MaintenanceLine | null;
  blocked_reason: GrammarBlockedReason | null;
  stats: Record<GrammarRuleId, RuleStat>;
}

// ── 문구 (IP/151 페르소나 · 더하기형 · 존대 평서형 — 서박사 승인요청서 E 대기) ─────────
/** 행동 문장 = 서박사 승인요청서 E1(G-PRO)·E3(G-AM)·E4(G-VEG) 원문 — E-SYNC 테스트로 고정(IP/integration/meal_grammar_p1_eval_v1.md v3) */
export const GRAMMAR_TEMPLATES: Record<GrammarRuleId, string> = {
  "G-PRO": "오늘 {slots}에는 단백질 반찬이 없었습니다. 다음 끼니에 달걀이나 두부 한 가지를 더합니다.",
  "G-VEG": "오늘 {slots}에는 김치 말고 채소 반찬이 없었습니다. 다음 끼니에 나물이나 쌈 한 가지를 더합니다.",
  "G-AM": "오늘 아침에는 단백질 반찬이 없었습니다. 내일 아침은 우유나 달걀 하나부터 시작합니다.",
};

export const GRAMMAR_WHY: Record<GrammarRuleId, string> = {
  "G-PRO": "사진 속 음식에서 달걀·두부·생선·고기·콩·유제품 반찬을 찾지 못했어요.",
  "G-VEG": "사진 속 음식에서 김치·장아찌 말고 채소 반찬을 찾지 못했어요.",
  "G-AM": "오늘 아침 사진에서 단백질 반찬을 찾지 못했어요.",
};

export const EVIDENCE_LABEL: Record<GrammarRuleId, string> = {
  "G-PRO": "단백질 반찬이 있었던 끼니",
  "G-VEG": "채소 반찬이 있었던 끼니",
  "G-AM": "단백질 반찬이 있었던 아침",
};

// ── 날짜 ────────────────────────────────────────────────────────────────────
export function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 검증 창 시작(로컬 0시) = 오늘 0시 − (days−1)일 */
export function windowStart(now: Date, days: number): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

// ── 행 → 끼니 (같은 날·같은 slot 합침, slot 없음·foods 없음 제외) ─────────────────
function foodNames(foods: unknown): string[] | null {
  if (!Array.isArray(foods) || foods.length === 0) return null;
  return foods.map((f) => (f && typeof f === "object" && typeof (f as { name_ko?: unknown }).name_ko === "string"
    ? (f as { name_ko: string }).name_ko : ""));
}

export function mealsFromRows(rows: readonly GrammarMealRow[], now: Date, days: number): GrammarMeal[] {
  const start = windowStart(now, days).getTime();
  const acc = new Map<string, GrammarMeal>();
  for (const r of rows) {
    const slot = (ALL_SLOTS as string[]).includes(r.meal_slot ?? "") ? (r.meal_slot as MealSlot) : null;
    if (!slot) continue;
    const t = new Date(r.eaten_at);
    if (!Number.isFinite(t.getTime()) || t.getTime() < start) continue;
    const names = foodNames(r.foods);
    if (!names) continue;
    const day = localDayKey(t);
    const key = `${day}|${slot}`;
    const cur = acc.get(key);
    if (cur) cur.names.push(...names);
    else acc.set(key, { day, slot, names: [...names] });
  }
  return [...acc.values()].sort((a, b) => (a.day === b.day ? ALL_SLOTS.indexOf(a.slot) - ALL_SLOTS.indexOf(b.slot) : a.day < b.day ? -1 : 1));
}

// ── 끼니 판정 ───────────────────────────────────────────────────────────────
function has(roleSets: Role[][], want: readonly Role[]): Tri {
  if (roleSets.some((rs) => rs.some((r) => want.includes(r)))) return true;
  if (roleSets.some((rs) => rs.includes("UNKNOWN"))) return null;
  return false;
}

export function judgeMeal(m: GrammarMeal): JudgedMeal {
  const rs = m.names.map((n) => resolveRoles(n));
  return {
    ...m,
    staple: has(rs, ["RICE", "NOODLE", "GRAIN_OTHER"]),
    protein: has(rs, ["PROTEIN"]),
    veg: has(rs, ["VEG"]),
  };
}

/** 규칙별 «기회»·«성공» (null = 이 끼니는 이 규칙의 기회 아님) */
export function ruleOutcome(rule: GrammarRuleId, m: JudgedMeal): boolean | null {
  if (rule === "G-AM") {
    if (m.slot !== "breakfast" || m.protein === null) return null;
    return m.protein;
  }
  if (!MAIN_SLOTS.includes(m.slot) || m.staple !== true) return null;
  const v = rule === "G-PRO" ? m.protein : m.veg;
  return v === null ? null : v;
}

export function evidenceText(rule: GrammarRuleId, success: number, opps: number, days: number): string | null {
  if (opps <= 0) return null;
  return `최근 ${days}일 ${EVIDENCE_LABEL[rule]} ${success}/${opps}`;
}

function fill(rule: GrammarRuleId, slots: MealSlot[]): string {
  return GRAMMAR_TEMPLATES[rule].replace("{slots}", slots.map((s) => SLOT_LABEL[s]).join("·"));
}

const RULE_IDS: GrammarRuleId[] = ["G-PRO", "G-VEG", "G-AM"];
const PROTEIN_RULES: GrammarRuleId[] = ["G-PRO", "G-AM"];

export function mealGrammarCoaching(input: MealGrammarInput): MealGrammarResult {
  const p = input.params ?? DEFAULT_MEAL_GRAMMAR_PARAMS;
  const safety = DEFAULT_GOAL_COACHING_PARAMS;
  const emptyStats = (): Record<GrammarRuleId, RuleStat> =>
    ({ "G-PRO": { opps: 0, success: 0, graduated: false }, "G-VEG": { opps: 0, success: 0, graduated: false }, "G-AM": { opps: 0, success: 0, graduated: false } });
  if (!input.mealEnabled || !input.loggedIn) return { active: null, maintenance: null, blocked_reason: null, stats: emptyStats() };

  // 안전 게이트 — 단백질 더하기만 차단(채소는 허용)
  let blocked_reason: GrammarBlockedReason | null = null;
  if (input.conditions.some((c) => safety.EXCLUDE_CONDITIONS.includes(c))) blocked_reason = "kidney_condition";
  else if (input.egfr != null && Number.isFinite(input.egfr) && input.egfr < safety.EGFR_BLOCK) blocked_reason = "egfr_low";

  const meals = mealsFromRows(input.rows, input.now, p.VERIFY_WINDOW_DAYS).map(judgeMeal);
  const today = localDayKey(input.now);

  // 검증 통계
  const stats = emptyStats();
  for (const rule of RULE_IDS) {
    for (const m of meals) {
      const o = ruleOutcome(rule, m);
      if (o === null) continue;
      stats[rule].opps += 1;
      if (o) stats[rule].success += 1;
    }
    const s = stats[rule];
    s.graduated = s.opps >= p.GRADUATE_MIN_OPPS && s.success / s.opps >= p.GRADUATE_RATE;
  }

  // 오늘 발화
  const todays = meals.filter((m) => m.day === today);
  const failSlots = (rule: GrammarRuleId) => todays.filter((m) => ruleOutcome(rule, m) === false).map((m) => m.slot);
  const fired: Record<GrammarRuleId, MealSlot[]> = { "G-PRO": failSlots("G-PRO"), "G-VEG": failSlots("G-VEG"), "G-AM": [] };
  // G-AM: 같은 아침이 이미 G-PRO 실패면 G-PRO 가 다룬다(설계 §4)
  fired["G-AM"] = failSlots("G-AM").filter((s) => !fired["G-PRO"].includes(s));

  const excluded = (rule: GrammarRuleId) =>
    (blocked_reason !== null && PROTEIN_RULES.includes(rule)) || (input.v1CardVisible && PROTEIN_RULES.includes(rule));

  const activeRule = p.ORDER.find((r) => fired[r].length > 0 && !stats[r].graduated && !excluded(r)) ?? null;
  const active: GrammarCard | null = activeRule
    ? {
        rule: activeRule,
        slots: fired[activeRule],
        text: fill(activeRule, fired[activeRule]),
        why: GRAMMAR_WHY[activeRule],
        evidence: { success: stats[activeRule].success, opps: stats[activeRule].opps },
        evidence_text: evidenceText(activeRule, stats[activeRule].success, stats[activeRule].opps, p.VERIFY_WINDOW_DAYS),
      }
    : null;

  const mRule = p.ORDER.find((r) => r !== activeRule && stats[r].graduated && !(blocked_reason !== null && PROTEIN_RULES.includes(r))) ?? null;
  const maintenance: MaintenanceLine | null = mRule
    ? { rule: mRule, success: stats[mRule].success, opps: stats[mRule].opps, text: `유지 중: ${EVIDENCE_LABEL[mRule]} ${stats[mRule].success}/${stats[mRule].opps}` }
    : null;

  return { active, maintenance, blocked_reason, stats };
}
