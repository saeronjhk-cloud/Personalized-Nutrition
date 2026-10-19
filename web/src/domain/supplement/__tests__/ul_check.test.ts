/** 합계 점검 v0 — 평가셋 IP/evals/eval_supp_ul_v0.json(복사본 fixtures/) U01~U16 + 입력 모델 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ulCheck, toUlUnit, supplementCheckLines, UL_TEXT, UL_NOTICE, type DoseEntry } from "../ul_check";
import { parseDoseStore, dosesFor, doseProductsFor } from "../ul_dose";
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
