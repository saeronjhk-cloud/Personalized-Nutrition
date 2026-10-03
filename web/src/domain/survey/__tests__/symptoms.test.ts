/** 증상 라벨 S01~S03 · 정본 IP/integration/survey_history_server_eval_v1.md v1.1 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SYMPTOM_GROUPS, symptomLabel } from "../symptoms";
import { SYMPTOM_SCORE_MAP } from "../../../engine/data";

describe("S 증상 라벨", () => {
  it("S01", () => expect(symptomLabel("brain_fog")).toBe("집중이 안 되고 머릿속이 안개 낀 느낌이에요"));
  it("S02", () => expect(symptomLabel("zzz_unknown")).toBe("zzz_unknown"));
  it("S03 고유·비어있지 않음·엔진 키 존재", () => {
    const all = SYMPTOM_GROUPS.flatMap((g) => g.symptoms);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of all) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(SYMPTOM_SCORE_MAP[s.id], s.id).toBeDefined();
    }
  });
  it("W3 배선", () => {
    const hr = readFileSync(resolve(__dirname, "../../../pages/HealthReport.tsx"), "utf-8");
    const q = readFileSync(resolve(__dirname, "../../../pages/Questions.tsx"), "utf-8");
    expect(hr).toContain("symptomLabel(");
    expect(q).toContain("domain/survey/symptoms");
    expect(q).not.toContain("const SYMPTOM_GROUPS");
  });
});
