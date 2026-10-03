/**
 * 목표 기반 식사 코칭 v1 — 순수 판정 (웹앱트랙 · 엔진 내부 결정론, AI 추론 없음 · 원칙5)
 *
 * 설계: IP/integration/goal_meal_coaching_design_v1.md · 평가: IP/integration/goal_meal_coaching_eval_v1.md (C01~C22)
 * 1차로 켜는 코칭은 «근육증가 → 끼니 단백질 더하기» 하나(설계 §2).
 *   - 체중관리: 열량 코칭 없음. 단백질 카드도 WEIGHT_PROTEIN_CARD(서박사 G2) 전엔 없음 + BMI<18.5 면 항상 없음.
 *   - 심혈관건강(나트륨): 데이터 가드 전 없음. 혈당관리: GI/GL 동결(IP/152). 나머지: 영양제 추천 전용.
 * 계산은 끼니 단위, 노출은 하루 카드 1장(IP/155 Q1). 값은 goal_coaching_params.ts 한 곳.
 * ⚠ 이 파일은 IO 를 import 하지 않는다(C20).
 */
import { DEFAULT_GOAL_COACHING_PARAMS, type GoalCoachingParams } from "./goal_coaching_params";

// ── 대응표 (설계 §1 v1 복사본 — C21 이 표와 대조) ─────────────────────────────
export type P0Goal = "weight" | "glucose" | "muscle" | "cardio" | "hypertension" | "recovery";

export const GOAL_TO_P0: Record<string, P0Goal[]> = {
  피로회복: ["recovery"],
  수면개선: ["recovery"],
  면역력강화: [],
  체중관리: ["weight"],
  간건강: [],
  소화장건강: [],
  근육증가: ["muscle"],
  피부개선: [],
  혈당관리: ["glucose"],
  눈건강: [],
  심혈관건강: ["cardio"],
  갱년기관리: [],
  인지력향상: [],
};

const P0_ORDER: P0Goal[] = ["weight", "glucose", "muscle", "cardio", "hypertension", "recovery"];

/** 앱 목표 + 기저질환 → P0 goal (중복 제거, P0 정의 순서). hypertension 은 기저질환 «고혈압» 에서 부가(규칙2). */
export function p0GoalsFor(goals: readonly string[], conditions: readonly string[]): P0Goal[] {
  const set = new Set<P0Goal>();
  for (const g of goals) for (const p of GOAL_TO_P0[g] ?? []) set.add(p);
  if (conditions.includes("고혈압")) set.add("hypertension");
  return P0_ORDER.filter((p) => set.has(p));
}

// ── 입력 ────────────────────────────────────────────────────────────────────
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
const MAIN_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

/** 오늘 한 끼(같은 끼니 여러 접시는 합산된 값). protein_g=null → 미상(0 으로 치지 않음). */
export interface CoachMeal {
  slot: MealSlot | null;
  protein_g: number | null;
  /** v1 판정에 쓰지 않음(열량·GI/GL 코칭 없음을 평가로 고정하기 위한 입력) */
  kcal?: number | null;
  carbs_g?: number | null;
}

export interface CoachingInput {
  mealEnabled: boolean;
  loggedIn: boolean;
  goals: readonly string[];
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  /** 설문 기저질환 */
  conditions: readonly string[];
  /** 최신 검진 eGFR (없으면 null) */
  egfr: number | null;
  meals: CoachMeal[];
  /** 오늘 끼니별 «단백질 반찬» 판정(true 있음 / false 없음 / null 미상) — 주어지면 false 끼니만 g 부족 판정(D-SIM1, 평가 v2 C23~C29).
   *  사진 g 과소추정 오경보 제거. 없으면 종전 동작. 출처 meal_grammar.ts proteinRoleBySlot */
  proteinRoleBySlot?: Partial<Record<MealSlot, boolean | null>>;
  /** 최근 7일 나트륨 — v1 은 판정에 쓰지 않음(데이터 가드 전) */
  sodium7d?: { avg_mg: number; known: boolean } | null;
  params?: GoalCoachingParams;
}

// ── 출력 ────────────────────────────────────────────────────────────────────
export type ShortLevel = "normal" | "strong";
export type BlockedReason = "kidney_condition" | "egfr_low" | "underweight" | "no_weight";

export interface MealShortfall {
  slot: MealSlot;
  protein_g: number;
  target_g: number;
  level: ShortLevel;
}

export interface ProteinCard {
  reason_code: "NL_LOW_PROTEIN_MEAL";
  /** 카드를 연 목표 */
  goal: "근육증가" | "체중관리";
  /** 끼니 중 가장 강한 부족 */
  level: ShortLevel;
  meals: MealShortfall[];
  text: string;
}

export interface CoachingResult {
  cards: ProteinCard[];
  blocked_reason: BlockedReason | null;
}

// ── 문구 (IP/151 페르소나: 존대 평서형 · 더하기형. 줄이기·체중·진단 표현 금지 — C22) ─────
// 서박사 G5 확인 대상. {slots} = «아침·점심» 식.
export const CARD_TEMPLATES: Record<ShortLevel, string> = {
  normal: "오늘 {slots} 단백질이 목표보다 조금 적었습니다. 다음 끼니에 달걀이나 두부 한 가지를 더합니다.",
  strong: "오늘 {slots} 단백질이 목표보다 많이 적었습니다. 다음 끼니에 살코기·생선·두부 중 한 가지를 손바닥 크기로 더합니다.",
};

export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식" };

// ── 계산 ────────────────────────────────────────────────────────────────────
/** 0.1 g 반올림 (경계 비교용 — 부동소수 경계 뒤집힘 방지, C04b·C05) */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function perMealTargetG(weightKg: number, age: number | null, p: GoalCoachingParams): number {
  let t = weightKg * p.PER_MEAL_G_PER_KG;
  if (p.ELDERLY_MIN_G != null && age != null && age >= p.ELDERLY_AGE) t = Math.max(t, p.ELDERLY_MIN_G);
  return round1(t);
}

function shortLevel(protein: number, target: number, p: GoalCoachingParams): ShortLevel | null {
  if (protein <= round1(target * (1 - p.SHORT_STRONG))) return "strong";
  if (protein <= round1(target * (1 - p.SHORT_NORMAL))) return "normal";
  return null;
}

/** 같은 끼니 여러 항목 → 1개. 전부 알면 합산, 하나라도 미상이면 미상(과소 합산으로 거짓 «부족» 방지). slot 없는 항목 제외. */
export function mergeBySlot(meals: readonly CoachMeal[]): { slot: MealSlot; protein_g: number | null }[] {
  const acc = new Map<MealSlot, { sum: number; unknown: boolean }>();
  for (const m of meals) {
    if (!m.slot || !ALL_SLOTS.includes(m.slot)) continue;
    const cur = acc.get(m.slot) ?? { sum: 0, unknown: false };
    const v = m.protein_g;
    if (v == null || !Number.isFinite(v)) cur.unknown = true;
    else cur.sum += v;
    acc.set(m.slot, cur);
  }
  return ALL_SLOTS.filter((s) => acc.has(s)).map((s) => {
    const a = acc.get(s)!;
    return { slot: s, protein_g: a.unknown ? null : round1(a.sum) };
  });
}

function fillText(level: ShortLevel, slots: MealSlot[]): string {
  return CARD_TEMPLATES[level].replace("{slots}", slots.map((s) => SLOT_LABEL[s]).join("·"));
}

export function goalMealCoaching(input: CoachingInput): CoachingResult {
  const p = input.params ?? DEFAULT_GOAL_COACHING_PARAMS;
  const none = (blocked_reason: BlockedReason | null = null): CoachingResult => ({ cards: [], blocked_reason });

  // 0) 기능 꺼짐·비로그인
  if (!input.mealEnabled || !input.loggedIn) return none();

  // 1) 카드를 여는 목표 — 근육증가 우선, 체중관리는 G2 플래그 + BMI 게이트
  let goal: ProteinCard["goal"] | null = null;
  if (input.goals.includes("근육증가")) goal = "근육증가";
  else if (p.WEIGHT_PROTEIN_CARD && input.goals.includes("체중관리")) {
    const w = input.weightKg, h = input.heightCm;
    const bmi = w && h ? w / ((h / 100) * (h / 100)) : null;
    if (bmi != null && Number.isFinite(bmi) && bmi < p.UNDERWEIGHT_BMI) return none("underweight");
    goal = "체중관리";
  }
  if (!goal) return none();

  // 2) 제외 게이트 (고단백 제안이 부적절할 수 있는 집단 — 서박사 E4·G4)
  if (input.conditions.some((c) => p.EXCLUDE_CONDITIONS.includes(c))) return none("kidney_condition");
  if (input.egfr != null && Number.isFinite(input.egfr) && input.egfr < p.EGFR_BLOCK) return none("egfr_low");

  // 3) 체중 없으면 목표 산출 불가 — 지어내지 않는다
  if (input.weightKg == null || !(input.weightKg > 0)) return none("no_weight");

  // 4)~6) 끼니별 판정 (주식 끼니만, 미상 제외)
  const target = perMealTargetG(input.weightKg, input.age, p);
  const shortfalls: MealShortfall[] = [];
  for (const m of mergeBySlot(input.meals)) {
    if (!MAIN_SLOTS.includes(m.slot) || m.protein_g == null) continue;
    if (input.proteinRoleBySlot && input.proteinRoleBySlot[m.slot] !== false) continue; // 반찬 있음·미상 → g 판정 안 함
    const level = shortLevel(m.protein_g, target, p);
    if (level) shortfalls.push({ slot: m.slot, protein_g: m.protein_g, target_g: target, level });
  }
  if (shortfalls.length === 0) return none();

  // 7) 하루 카드 1장
  const level: ShortLevel = shortfalls.some((s) => s.level === "strong") ? "strong" : "normal";
  return {
    cards: [{
      reason_code: "NL_LOW_PROTEIN_MEAL",
      goal,
      level,
      meals: shortfalls,
      text: fillText(level, shortfalls.map((s) => s.slot)),
    }],
    blocked_reason: null,
  };
}

// ── meal_log 행 → CoachMeal (실섭취 우선: meal_diet_bridge 와 같은 규칙, C14) ──────────
export interface CoachMealRow {
  eaten_at: string;
  meal_slot: string | null;
  summary?: { total_protein_g?: number | null } | null;
  adjusted_summary?: { total_protein_g?: number | null } | null;
  /** 음식 목록(단백질 반찬 판정용, D-SIM1) */
  foods?: unknown;
}

export function mealRowsToCoachMeals(rows: readonly CoachMealRow[]): CoachMeal[] {
  const items: CoachMeal[] = rows.map((r) => {
    const s = r.adjusted_summary ?? r.summary ?? {};
    const v = s.total_protein_g;
    const slot = (ALL_SLOTS as string[]).includes(r.meal_slot ?? "") ? (r.meal_slot as MealSlot) : null;
    return { slot, protein_g: v == null || !Number.isFinite(v) ? null : v };
  });
  return mergeBySlot(items);
}
