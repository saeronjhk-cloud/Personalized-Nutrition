/**
 * 설문 기록 서버 우선 읽기 H01~H12 · 정본 IP/integration/survey_history_server_eval_v1.md
 */
import { describe, it, expect } from "vitest";
import { serverRowsToHistory, chooseHistory, resurveyState } from "../history";
import type { RecommendationResult, SurveyRecord } from "../../../types";

const R = (tag: string) => ({ tag } as unknown as RecommendationResult);
const compute = (a: any) => R(String(a?.나이));
const row = (id: string, created_at: string, answers: unknown = { 나이: 40 }) => ({ id, created_at, answers });
const loc = (id: string, date: string): SurveyRecord => ({ id, date, answers: { 나이: 1 } as any, result: R("local") });
const L2 = [loc("l1", "2026-09-01T00:00:00Z"), loc("l2", "2026-08-01T00:00:00Z")];

describe("H 설문 기록 서버 우선", () => {
  it("H01 비로그인 → local", () =>
    expect(chooseHistory({ loggedIn: false, serverOk: false, server: [], local: L2 })).toBe(L2));
  it("H02 로그인 · 서버 4 → 서버 4 최신순", () => {
    const s = serverRowsToHistory([
      row("a", "2026-06-20T07:17:42Z"), row("d", "2026-09-30T00:27:10Z"), row("b", "2026-07-10T00:00:00Z"), row("c", "2026-08-10T00:00:00Z"),
    ], compute);
    const h = chooseHistory({ loggedIn: true, serverOk: true, server: s, local: [] });
    expect(h.map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
  });
  it("H03 로그인 · 서버 0 · local 2 → 0", () =>
    expect(chooseHistory({ loggedIn: true, serverOk: true, server: [], local: L2 })).toEqual([]));
  it("H04 로그인 · 서버 오류 → local 폴백", () =>
    expect(chooseHistory({ loggedIn: true, serverOk: false, server: [], local: L2 })).toBe(L2));
  it("H05 compute 예외 행만 빠짐", () => {
    const c = (a: any) => { if (a.나이 === 99) throw new Error("x"); return R("ok"); };
    expect(serverRowsToHistory([row("a", "2026-09-01T00:00:00Z", { 나이: 99 }), row("b", "2026-09-02T00:00:00Z")], c).map((r) => r.id)).toEqual(["b"]);
  });
  it("H06 answers 비정상 행 빠짐", () =>
    expect(serverRowsToHistory([row("a", "2026-09-01T00:00:00Z", null), row("b", "2026-09-02T00:00:00Z", "x"), row("c", "2026-09-03T00:00:00Z")], compute).map((r) => r.id)).toEqual(["c"]));
  it("H07 상한 20", () => {
    const rows = Array.from({ length: 25 }, (_, i) => row(`r${i}`, new Date(Date.UTC(2026, 0, i + 1)).toISOString()));
    expect(serverRowsToHistory(rows, compute)).toHaveLength(20);
  });
  it("H08 date = created_at · id = 서버 id", () =>
    expect(serverRowsToHistory([row("x1", "2026-09-30T00:27:10.415257+00:00")], compute)[0]).toMatchObject({ id: "x1", date: "2026-09-30T00:27:10.415257+00:00" }));
  it("H09 31일 → prompt", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    const s = resurveyState([loc("a", "2026-09-30T00:00:00Z")], now);
    expect(s).toMatchObject({ prompt: true, daysSince: 31 });
  });
  it("H10 29일 → 아님 · 빈 기록", () => {
    expect(resurveyState([loc("a", "2026-10-02T00:00:00Z")], new Date("2026-10-31T00:00:00Z")).prompt).toBe(false);
    expect(resurveyState([], new Date())).toMatchObject({ latest: null, daysSince: -1, prompt: false, canCompare: false });
  });
  it("H11 비교 가능 = 2건 이상", () => {
    expect(resurveyState(L2, new Date()).canCompare).toBe(true);
    expect(resurveyState([L2[0]], new Date()).canCompare).toBe(false);
  });
  it("H12 result = compute(answers)", () =>
    expect(serverRowsToHistory([row("a", "2026-09-01T00:00:00Z", { 나이: 57 })], compute)[0].result).toEqual(R("57")));
});
