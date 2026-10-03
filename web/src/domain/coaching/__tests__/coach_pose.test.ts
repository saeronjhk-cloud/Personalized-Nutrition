/** IP/integration/coach_card_pose_eval_v1.md — P01~P10 · W1 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { grammarPose, v1Pose } from "../coach_pose";
import { COACH_POSES } from "../../../components/CoachAvatar";

const m = { rule: "G-PRO", success: 3, opps: 4, text: "x" };

describe("코칭 카드 캐릭터 포즈", () => {
  it("P01~P03 활성 규칙별", () => {
    expect(grammarPose({ active: { rule: "G-PRO" }, maintenance: null })).toBe("d4_protein");
    expect(grammarPose({ active: { rule: "G-VEG" }, maintenance: null })).toBe("d5_veggie");
    expect(grammarPose({ active: { rule: "G-AM" }, maintenance: null })).toBe("c2_advice");
  });
  it("P04 활성 우선", () => expect(grammarPose({ active: { rule: "G-VEG" }, maintenance: m })).toBe("d5_veggie"));
  it("P05 유지 줄만", () => expect(grammarPose({ active: null, maintenance: m })).toBe("a1_thumbs"));
  it("P06 둘 다 없음", () => expect(grammarPose({ active: null, maintenance: null })).toBeNull());
  it("P07·P08 v1", () => {
    expect(v1Pose({ level: "normal" })).toBe("d4_protein");
    expect(v1Pose({ level: "strong" })).toBe("c1_concern");
  });
  it("P09·P10 모든 결과가 실제 파일 포즈 · 금지 포즈 없음", () => {
    const all = [
      ...(["G-PRO", "G-VEG", "G-AM"] as const).map((r) => grammarPose({ active: { rule: r }, maintenance: null })),
      grammarPose({ active: null, maintenance: m }), v1Pose({ level: "normal" }), v1Pose({ level: "strong" }),
    ];
    for (const p of all) expect(COACH_POSES as readonly string[]).toContain(p);
    for (const bad of ["c3_gentle_stop", "e2_sorry"]) expect(all).not.toContain(bad);
  });
  it("W1 카드는 순수 함수 결과만 사용", () => {
    const g = readFileSync(resolve(__dirname, "../../../components/MealGrammarCard.tsx"), "utf8");
    const v = readFileSync(resolve(__dirname, "../../../components/GoalCoachingCard.tsx"), "utf8");
    expect(g).toContain("grammarPose(");
    expect(v).toContain("v1Pose(");
    expect(g + v).not.toMatch(/<CoachAvatar pose="/);
  });
});
