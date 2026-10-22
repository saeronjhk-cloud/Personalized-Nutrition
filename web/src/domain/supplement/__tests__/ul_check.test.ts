/** 합계 점검 v0·v1 — 평가셋 IP/evals/eval_supp_ul_v0.json(복사본 fixtures/) U01~U16 + 입력 모델 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ulCheck, toUlUnit, supplementCheckLines, UL_TEXT, UL_NOTICE, type DoseEntry } from "../ul_check";
import { parseDoseStore, dosesFor, doseProductsFor, DOSE_PRODUCTS } from "../ul_dose";
import { reduceCheck } from "../reduce_check";
import { BANNED_WORDS } from "../../checkup/compliance";
import { SUPP_UL_ENABLED } from "../../../lib/flags";
import type { SurveyAnswers } from "../../../types";

interface Case { id: string; sex: string; age: number; doses: DoseEntry[]; lines: { n: string; sum: number; ul: number }[] }
const EV = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_supp_ul_v0.json"), "utf-8")) as { text: string; notice: string; rules: Record<string, string>; cases: Case[] };
const RB = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_supplement_check_v1.2.json"), "utf-8")) as { base: SurveyAnswers };

describe("합계 점검 v0 평가셋", () => {
  it("케이스 15건 + 문구가 평가셋 정본과 같음", () => {
    expect(EV.cases.length).toBe(15);
    expect(UL_TEXT).toBe(EV.text);
    expect(UL_NOTICE).toBe(EV.notice);
  });
  for (const c of EV.cases) {
    it(c.id, () => {
      const got = ulCheck(c.sex, c.age, c.doses).map((l) => ({ n: l.n, sum: Math.round(l.sum * 10) / 10, ul: l.ul }));
      expect(got).toEqual(c.lines);
    });
  }
  it("U03 문구 전체", () => {
    const l = ulCheck("male", 40, EV.cases.find((c) => c.id === "U03")!.doses)[0];
    expect(l.text).toBe(EV.rules.U03_text);
  });
  it("U11 엽산 DFE 환산 470.6", () => expect(Math.round(toUlUnit("folic_acid", 800, "μg DFE")! * 10) / 10).toBe(470.6));
  it("U14 UL 줄이 기존 점검보다 먼저 · 최대 2줄", () => {
    const a = { ...RB.base, 성별: "male", 나이: 40, 현재복용영양제: ["iron", "multivitamin", "vitamin_d"] } as SurveyAnswers;
    expect(reduceCheck(a).length).toBeGreaterThan(0);
    const doses: DoseEntry[] = [{ n: "vitamin_d", v: 5000, u: "IU" }, { n: "vitamin_b6", v: 100, u: "mg" }];
    const lines = supplementCheckLines(a, doses, true);
    expect(lines.map((l) => l.key)).toEqual(["UL_vitamin_d", "UL_vitamin_b6"]);
    expect(supplementCheckLines(a, doses, false).map((l) => l.key)).toEqual(reduceCheck(a).map((l) => l.id));
  });
  it("U16 금지 표현 없음 · «주세요.» 로 끝남", () => {
    const all = EV.cases.flatMap((c) => ulCheck(c.sex, c.age, c.doses).map((l) => l.text));
    expect(all.length).toBeGreaterThan(0);
    for (const t of [...all, UL_NOTICE]) {
      for (const w of ["위험", "초과 경고", "끊", "중단", "보수적"]) expect(t).not.toContain(w);
      for (const w of BANNED_WORDS) expect(t).not.toContain(w);
    }
    for (const t of all) expect(t.endsWith("주세요.")).toBe(true);
  });
  it("단위가 성분과 맞지 않으면 무시", () => {
    expect(toUlUnit("calcium", 100, "IU")).toBeNull();
    expect(toUlUnit("vitamin_d", 100, "mg")).toBeNull();
    expect(toUlUnit("vitamin_c", "2500", "mg")).toBe(2500);
  });
  it("플래그 기본 OFF", () => expect(SUPP_UL_ENABLED).toBe(false));
});

describe("합계 점검 v0 입력 모델", () => {
  it("손상된 저장값은 빈 값", () => {
    expect(parseDoseStore("{bad")).toEqual({});
    expect(parseDoseStore('{"multivitamin":{"calcium":{"v":"500","u":"IU"}}}')).toEqual({});
    expect(parseDoseStore('{"vitamin_d":{"vitamin_d":{"v":"1000","u":"IU"}}}')).toEqual({ vitamin_d: { vitamin_d: { v: "1000", u: "IU" } } });
  });
  it("지금 드시는 제품만 계산에 넣음", () => {
    const st = { vitamin_d: { vitamin_d: { v: "4000", u: "IU" as const } }, calcium: { calcium: { v: "900", u: "mg" as const } } };
    expect(dosesFor(st, ["vitamin_d"])).toEqual([{ n: "vitamin_d", v: "4000", u: "IU" }]);
    expect(doseProductsFor(["omega3", "iron", "multivitamin"]).map((p) => p.id)).toEqual(["multivitamin", "iron"]);
  });
});

/* ── v1 (10-20): 니아신 형태별 · 비타민B군·아연 제품 칸 — 평가셋 IP/evals/eval_supp_ul_v1.json ── */
interface CaseV1 extends Omit<Case, "lines"> { lines: { n: string; sum: number; ul: number; unknown?: boolean }[] }
const EV1 = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_supp_ul_v1.json"), "utf-8")) as { text: string; notice: string; rules: Record<string, string>; cases: CaseV1[] };

describe("합계 점검 v1 평가셋", () => {
  it("31건 · v0.2 15건 그대로 승계 · 문구 동일", () => {
    expect(EV1.cases.length).toBe(31);
    expect(EV1.cases.slice(0, 15)).toEqual(EV.cases);
    expect(EV1.text).toBe(UL_TEXT);
    expect(EV1.notice).toBe(UL_NOTICE);
  });
  for (const c of EV1.cases) {
    it(c.id, () => {
      const got = ulCheck(c.sex, c.age, c.doses).map((l) => ({ n: l.n, sum: Math.round(l.sum * 10) / 10, ul: l.ul, ...(l.unknown ? { unknown: true } : {}) }));
      expect(got).toEqual(c.lines);
    });
  }
  for (const id of ["N02", "N03", "N05"]) it(`${id} 문구 전체`, () => {
    const c = EV1.cases.find((x) => x.id === id)!;
    expect(ulCheck(c.sex, c.age, c.doses)[0].text).toBe(EV1.rules[`${id}_text`]);
  });
  it("니아신 줄도 금지 표현 없음 · «주세요.» 로 끝남", () => {
    const all = EV1.cases.flatMap((c) => ulCheck(c.sex, c.age, c.doses).map((l) => l.text));
    for (const t of all) {
      for (const w of ["위험", "초과 경고", "끊", "중단", "보수적"]) expect(t).not.toContain(w);
      for (const w of BANNED_WORDS) expect(t).not.toContain(w);
      expect(t.endsWith("주세요.")).toBe(true);
    }
  });
});

describe("합계 점검 v1 입력 모델", () => {
  it("니아신 형태 저장·복원 · 잘못된 형태는 버림(→ 모름 취급)", () => {
    expect(parseDoseStore('{"vitamin_b":{"niacin":{"v":"100","u":"mg","f":"amide"}}}')).toEqual({ vitamin_b: { niacin: { v: "100", u: "mg", f: "amide" } } });
    expect(parseDoseStore('{"vitamin_b":{"niacin":{"v":"100","u":"mg","f":"xx"}}}')).toEqual({ vitamin_b: { niacin: { v: "100", u: "mg" } } });
    expect(parseDoseStore('{"zinc":{"calcium":{"v":"100","u":"mg","f":"acid"}}}')).toEqual({});
  });
  it("비타민B군·아연 제품 칸 · 지금 드시는 것만", () => {
    expect(doseProductsFor(["zinc", "vitamin_b", "omega3"]).map((p) => p.id)).toEqual(["vitamin_b", "zinc"]);
    const st = { vitamin_b: { niacin: { v: "40", u: "mg" as const, f: "acid" as const } }, zinc: { zinc: { v: "40", u: "mg" as const } } };
    expect(dosesFor(st, ["vitamin_b"])).toEqual([{ n: "niacin", v: "40", u: "mg", f: "acid" }]);
    expect(ulCheck("male", 40, dosesFor(st, ["vitamin_b", "zinc"])).map((l) => l.n)).toEqual(["zinc", "niacin_acid"]);
  });
});

describe("합계 점검 v1 — id 일치 가드", () => {
  it("설문 «현재 복용» id 는 모두 추천 엔진 SUPPLEMENTS id(종합비타민 제외) — 이미 드시는 것은 추천에서 빠져야 함", async () => {
    const { CURRENT_SUPPLEMENT_OPTIONS } = await import("../../survey/supplement_options");
    const { SUPPLEMENTS } = await import("../../../engine/data");
    const eng = new Set(SUPPLEMENTS.map((s) => s.id));
    const miss = CURRENT_SUPPLEMENT_OPTIONS.flatMap((o) => o.ids).filter((id) => id !== "multivitamin" && !eng.has(id));
    expect(miss).toEqual([]);
  });
  it("입력 칸 제품은 모두 설문 선택지에 있음", async () => {
    const { CURRENT_SUPPLEMENT_OPTIONS } = await import("../../survey/supplement_options");
    const ids = new Set(CURRENT_SUPPLEMENT_OPTIONS.flatMap((o) => o.ids));
    expect(DOSE_PRODUCTS.map((p) => p.id).filter((id) => !ids.has(id))).toEqual([]);
  });
});
