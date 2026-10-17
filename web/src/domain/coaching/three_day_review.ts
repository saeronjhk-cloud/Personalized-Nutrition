/**
 * 3일 돌아보기 v1 (순수 · 결정론) — 코칭 제안 뒤 실제 식사 기록으로 «했는지»를 사실 한 줄로 돌려준다.
 * 설계·평가 IP/integration/three_day_review_v1/00_설계·평가셋_v1.md (T01~T15)
 * - 판정은 끼니 문법 엔진(judgeMeal·ruleOutcome)만 재사용. 새 음식 해석 0 · 버튼·DB 0.
 * - 문장은 사실 서술(관찰)만, 부정·탓하는 문장 없음(«0일» 금지 — 조건이 안 되면 null).
 */
import { DEFAULT_GOAL_COACHING_PARAMS, kidneyBlockReason } from "./goal_coaching_params";
import { DEFAULT_MEAL_GRAMMAR_PARAMS, type GrammarRuleId } from "./meal_grammar_params";
import { judgeMeal, localDayKey, mealsFromRows, ruleOutcome, SLOT_LABEL, type JudgedMeal, type MealGrammarInput } from "./meal_grammar";

export const REVIEW_DAYS = 3;

export const REVIEW_TARGET: Record<GrammarRuleId, string> = {
  "G-PRO": "단백질 반찬",
  "G-VEG": "채소 반찬",
  "G-AM": "단백질 반찬",
};

export interface ThreeDayReview {
  rule: GrammarRuleId;
  kind: "follow" | "summary";
  text: string;
}

const PROTEIN_RULES: GrammarRuleId[] = ["G-PRO", "G-AM"];

function dayWord(day: string, now: Date): string {
  const d = new Date(now);
  for (const w of ["오늘", "어제", "그저께"]) {
    if (localDayKey(d) === day) return w;
    d.setDate(d.getDate() - 1);
  }
  return day;
}

/** activeRule = 오늘 활성 카드 규칙(없으면 null) */
export function threeDayReview(input: MealGrammarInput, activeRule: GrammarRuleId | null): ThreeDayReview | null {
  if (!input.mealEnabled || !input.loggedIn) return null;
  const p = input.params ?? DEFAULT_MEAL_GRAMMAR_PARAMS;
  const blocked = kidneyBlockReason(input, DEFAULT_GOAL_COACHING_PARAMS) !== null;
  const allowed = (r: GrammarRuleId) => !(blocked && PROTEIN_RULES.includes(r));

  const meals: JudgedMeal[] = mealsFromRows(input.rows, input.now, REVIEW_DAYS).map(judgeMeal);
  const outcomes = (rule: GrammarRuleId) =>
    meals.map((m) => ({ m, o: ruleOutcome(rule, m) })).filter((x): x is { m: JudgedMeal; o: boolean } => x.o !== null);

  const order: GrammarRuleId[] = [
    ...(activeRule && allowed(activeRule) ? [activeRule] : []),
    ...p.ORDER.filter((r) => r !== activeRule && allowed(r)),
  ];
  const rule = order.find((r) => outcomes(r).length > 0);
  if (!rule) return null;
  const seq = outcomes(rule);
  const target = REVIEW_TARGET[rule];

  // 1) 따라 하기: 실패 → 바로 다음 기회 성공 (가장 최근)
  for (let i = seq.length - 1; i >= 1; i--) {
    if (seq[i].o && !seq[i - 1].o) {
      const a = seq[i - 1].m, b = seq[i].m;
      return {
        rule, kind: "follow",
        text: `${dayWord(a.day, input.now)} ${SLOT_LABEL[a.slot]}에는 ${target}이 없었는데, ${dayWord(b.day, input.now)} ${SLOT_LABEL[b.slot]}에는 있었어요.`,
      };
    }
  }

  // 2) 3일 요약: 기회 있던 날 ≥2 · 그날 기회 끼니 모두 성공한 날 ≥1
  const byDay = new Map<string, boolean>();
  for (const { m, o } of seq) byDay.set(m.day, (byDay.get(m.day) ?? true) && o);
  const good = [...byDay.values()].filter(Boolean).length;
  if (byDay.size >= 2 && good >= 1) {
    return { rule, kind: "summary", text: `최근 ${REVIEW_DAYS}일 중 ${good}일은 끼니마다 ${target}이 있었어요.` };
  }
  return null;
}
