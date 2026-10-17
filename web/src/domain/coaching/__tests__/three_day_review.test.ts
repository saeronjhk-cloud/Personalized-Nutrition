/** 3일 돌아보기 v1 — 평가셋 IP/integration/three_day_review_v1/00_설계·평가셋_v1.md T01~T15 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { threeDayReview } from "../three_day_review";
import type { GrammarMealRow, MealGrammarInput } from "../meal_grammar";
import { BANNED_WORDS } from "../../checkup/compliance";

const NOW = new Date(2026, 9, 17, 20, 0, 0); // 2026-10-17 20:00 로컬
const HOUR: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 18, snack: 15 };
const row = (slot: string, names: string[], daysAgo = 0): GrammarMealRow => {
  const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(HOUR[slot], 0, 0, 0);
  return { eaten_at: d.toISOString(), meal_slot: slot, foods: names.map((n) => ({ name_ko: n })) };
};
const IN = (rows: GrammarMealRow[], over: Partial<MealGrammarInput> = {}): MealGrammarInput => ({
  mealEnabled: true, loggedIn: true, rows, now: NOW, conditions: [], egfr: null, v1CardVisible: false, ...over,
});
const NOPRO = ["쌀밥", "김치찌개", "시금치나물"]; // 단백질 없음 · 채소 있음
const PRO = ["쌀밥", "제육볶음", "상추"];        // 둘 다 있음
const NOVEG = ["쌀밥", "계란찜", "배추김치"];     // 단백질 있음 · 채소 없음

describe("T 3일 돌아보기", () => {
  it("T01 기록 없음 → null", () => expect(threeDayReview(IN([]), null)).toBeNull());
  it("T02 어제 저녁 실패 → 오늘 아침 성공", () => {
    const r = threeDayReview(IN([row("dinner", NOPRO, 1), row("breakfast", PRO, 0)]), null);
    expect(r?.text).toBe("어제 저녁에는 단백질 반찬이 없었는데, 오늘 아침에는 있었어요.");
    expect(r?.kind).toBe("follow");
  });
  it("T03 같은 날 점심 실패 → 저녁 성공", () => {
    expect(threeDayReview(IN([row("lunch", NOPRO), row("dinner", PRO)]), null)?.text)
      .toBe("오늘 점심에는 단백질 반찬이 없었는데, 오늘 저녁에는 있었어요.");
  });
  it("T04 실패 → 다음도 실패: 따라 하기 아님(요약 조건도 안 되면 null)", () => {
    expect(threeDayReview(IN([row("lunch", NOPRO), row("dinner", NOPRO)]), null)).toBeNull();
  });
  it("T05 따라 하기 2건 → 가장 최근", () => {
    const r = threeDayReview(IN([row("lunch", NOPRO, 2), row("dinner", PRO, 2), row("lunch", NOPRO, 0), row("dinner", PRO, 0)]), null);
    expect(r?.text).toBe("오늘 점심에는 단백질 반찬이 없었는데, 오늘 저녁에는 있었어요.");
  });
  it("T06 3일 요약 — 2일 전부 성공", () => {
    const r = threeDayReview(IN([row("lunch", PRO, 2), row("lunch", PRO, 1), row("dinner", NOPRO, 0)]), null);
    expect(r?.text).toBe("최근 3일 중 2일은 끼니마다 단백질 반찬이 있었어요.");
    expect(r?.kind).toBe("summary");
  });
  it("T07 성공한 날 0일 → null(«0일» 금지)", () => {
    expect(threeDayReview(IN([row("lunch", NOPRO, 2), row("lunch", NOPRO, 1)]), null)).toBeNull();
  });
  it("T08 기회 있는 날 1일뿐 → null", () => {
    expect(threeDayReview(IN([row("lunch", PRO), row("dinner", PRO)]), null)).toBeNull();
  });
  it("T09 4일 전은 창 밖", () => {
    expect(threeDayReview(IN([row("dinner", NOPRO, 3), row("breakfast", PRO, 2)]), null)).toBeNull();
  });
  it("T10 간식·밥 없는 끼니는 기회 아님", () => {
    expect(threeDayReview(IN([row("snack", ["사과"], 1), row("lunch", ["사과"], 1), row("lunch", PRO, 0)]), null)).toBeNull();
  });
  it("T11 신장 안전 차단(요단백 +1) → 단백질 규칙 제외, 채소로", () => {
    const r = threeDayReview(IN([row("lunch", NOVEG, 1), row("dinner", PRO, 1)], { urineProtein: 1 }), null);
    expect(r?.rule).toBe("G-VEG");
    expect(r?.text).toBe("어제 점심에는 채소 반찬이 없었는데, 어제 저녁에는 있었어요.");
  });
  it("T12 활성 카드 G-VEG → 채소 기준", () => {
    const r = threeDayReview(IN([row("lunch", NOVEG), row("dinner", PRO)]), "G-VEG");
    expect(r?.rule).toBe("G-VEG");
  });
  it("T13 그저께 표기", () => {
    expect(threeDayReview(IN([row("dinner", NOPRO, 2), row("lunch", PRO, 1)]), null)?.text)
      .toBe("그저께 저녁에는 단백질 반찬이 없었는데, 어제 점심에는 있었어요.");
  });
  it("T14 문장 금지어·부정어 0 · 끝 «요.»", () => {
    const cases = [
      threeDayReview(IN([row("dinner", NOPRO, 1), row("breakfast", PRO, 0)]), null),
      threeDayReview(IN([row("lunch", PRO, 2), row("lunch", PRO, 1), row("dinner", NOPRO, 0)]), null),
      threeDayReview(IN([row("lunch", NOVEG), row("dinner", PRO)]), "G-VEG"),
    ];
    for (const r of cases) {
      expect(r).not.toBeNull();
      for (const w of [...BANNED_WORDS, "0일", "못", "또 "]) expect(r!.text).not.toContain(w);
      expect(r!.text.endsWith("요.")).toBe(true);
    }
  });
  it("T15 화면은 함수 결과만 그린다(MealGrammarCard)", () => {
    const src = readFileSync(resolve(__dirname, "../../../components/MealGrammarCard.tsx"), "utf-8");
    expect(src).toContain("threeDayReview(input, ");
    expect(src).toContain('data-testid="three-day-review"');
    expect(src).not.toMatch(/단백질 반찬이 없었는데/);
  });
});
