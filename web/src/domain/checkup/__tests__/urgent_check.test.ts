/** 검진 신속 확인 U01~U14·W2 · 정본 IP/integration/checkup_urgent_check_eval_v1.md */
import { describe, it, expect } from "vitest";
import { urgentChecks, URGENT_RULES, URGENT_FOOTER } from "../urgent_check";
import type { CategoryResult } from "../engine";
import { BANNED_WORDS } from "../compliance";

const r = (biomarker_key: string, value: number, level = "high"): CategoryResult => ({
  biomarker_key, value, level, label_ko: null, functional_needs: [], tone: null, force_medical_referral: false, matched_range_id: null,
});
const ids = (xs: CategoryResult[]) => urgentChecks(xs).map((u) => u.id);

describe("신속 확인 판정", () => {
  it("U01 수축기 180 경계 포함", () => expect(ids([r("blood_pressure_systolic", 180)])).toEqual(["bp_severe"]));
  it("U02 수축기 179·이완기 100 없음", () => expect(ids([r("blood_pressure_systolic", 179), r("blood_pressure_diastolic", 100)])).toEqual([]));
  it("U03 이완기 120", () => expect(ids([r("blood_pressure_diastolic", 120)])).toEqual(["bp_severe"]));
  it("U04 170/119 없음", () => expect(ids([r("blood_pressure_systolic", 170), r("blood_pressure_diastolic", 119)])).toEqual([]));
  it("U05 200/125 한 건 · 값 둘 다", () => {
    const u = urgentChecks([r("blood_pressure_systolic", 200), r("blood_pressure_diastolic", 125)]);
    expect(u).toHaveLength(1);
    expect(u[0].values).toEqual([{ key: "blood_pressure_systolic", value: 200 }, { key: "blood_pressure_diastolic", value: 125 }]);
  });
  it("U06 공복혈당 300 · 오늘 중", () => {
    const u = urgentChecks([r("fasting_glucose", 300)]);
    expect(u.map((x) => x.id)).toEqual(["glucose_very_high"]);
    expect(u[0].steps.join(" ")).toContain("오늘 중");
  });
  it("U07 공복혈당 299 없음", () => expect(ids([r("fasting_glucose", 299)])).toEqual([]));
  it("U08 혈당 350 + 수축기 185 → 혈압 먼저", () =>
    expect(ids([r("fasting_glucose", 350), r("blood_pressure_systolic", 185)])).toEqual(["bp_severe", "glucose_very_high"]));
  it("U09 LDL·중성지방 대상 아님", () => expect(ids([r("LDL", 250), r("triglyceride", 900)])).toEqual([]));
  it("U10 HbA1c 12 대상 아님", () => expect(ids([r("HbA1c", 12)])).toEqual([]));
  it("U11 NaN·unknown 무시", () => expect(ids([r("blood_pressure_systolic", Number.NaN, "unknown"), r("fasting_glucose", 90, "unknown")])).toEqual([]));
  it("U14 빈 결과", () => expect(urgentChecks([])).toEqual([]));
});

describe("신속 확인 문구", () => {
  const texts = [...URGENT_RULES.flatMap((x) => [x.title, ...x.steps, x.emergency]), URGENT_FOOTER];
  it("U12 금지어·질병명 0 · 진단 아님", () => {
    for (const t of texts) {
      for (const w of BANNED_WORDS) expect(t).not.toContain(w);
      expect(t).not.toMatch(/고혈압|당뇨|위기|케톤|쇼크/);
    }
    expect(URGENT_FOOTER).toContain("진단이 아닙니다");
  });
  it("U13 혈압 5분·다시·119 / 혈당 결과지·119", () => {
    const bp = URGENT_RULES.find((x) => x.id === "bp_severe")!;
    const gl = URGENT_RULES.find((x) => x.id === "glucose_very_high")!;
    const bpText = [...bp.steps, bp.emergency].join(" ");
    expect(bpText).toContain("5분");
    expect(bpText).toContain("다시");
    expect(bpText).toContain("119");
    const glText = [...gl.steps, gl.emergency].join(" ");
    expect(glText).toContain("결과지");
    expect(glText).toContain("119");
  });
  it("W2 규칙 id 2개", () => expect(URGENT_RULES.map((x) => x.id)).toEqual(["bp_severe", "glucose_very_high"]));
});
