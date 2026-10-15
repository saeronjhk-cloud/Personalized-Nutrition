/**
 * 검진 OCR 합성 평가 S01~S18 — 6가지 서식 × 3가지 촬영 상태(스캔·사진·흐린 기울어진 사진)
 * 실제 Google Vision 응답(단어 상자)을 고정 표본으로 저장해 두고 채점한다. 값·이름은 모두 가짜.
 * 평가셋 IP/integration/checkup_ocr_v1/00_설계·평가셋_v1.md §6 · 생성기 synth/gen.py
 */
import { describe, it, expect } from "vitest";
import fx from "./fixtures/checkup_ocr_synth_v1.json";
import { ocrPagesToCheckupText, type OcrWord } from "../checkupOcr";
import { parseCheckupText } from "../checkupImport";

type Truth = { date: string; expected: Record<string, number> };
const words = fx.words as unknown as Record<string, OcrWord[]>;
const truth = fx.truth as unknown as Record<string, Truth>;

function score(key: string) {
  const r = parseCheckupText(ocrPagesToCheckupText([words[key]]));
  const got = Object.fromEntries(r.items.map((i) => [i.label, i.value]));
  const exp = truth[key].expected;
  const wrong = Object.entries(got).filter(([k, v]) => !(k in exp) || Math.abs((exp[k] as number) - v) > 1e-6).map(([k, v]) => `${k}=${v}`);
  const ok = Object.entries(exp).filter(([k, v]) => got[k] !== undefined && Math.abs(got[k] - v) < 1e-6).length;
  return { ok, n: Object.keys(exp).length, wrong, date: r.date };
}

describe("S 합성 표본 18건", () => {
  const keys = Object.keys(truth).sort();
  it("S00 표본 18건", () => expect(keys).toHaveLength(18));
  for (const k of keys) {
    it(`${k} 오값 0 · 검진일 일치`, () => {
      const s = score(k);
      expect(s.wrong).toEqual([]);
      expect(s.date).toBe(truth[k].date);
    });
  }
  it("S99 전체 일치율 ≥ 95%(빈칸은 사용자가 입력)", () => {
    let ok = 0, n = 0;
    for (const k of keys) { const s = score(k); ok += s.ok; n += s.n; }
    expect(ok / n).toBeGreaterThanOrEqual(0.95);
  });
  it("S98 스캔본 6건은 전부 일치", () => {
    for (const k of keys.filter((x) => x.endsWith("_scan"))) { const s = score(k); expect(s.ok, k).toBe(s.n); }
  });
});
