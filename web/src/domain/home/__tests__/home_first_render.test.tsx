/** 홈 첫 렌더 깜빡임 — P01~P14 · 평가 IP/integration/home_first_render_eval_v1.md */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn() }, from: vi.fn(), rpc: vi.fn() } }));

import { decideHomeView } from "../home_mode";
import { hasStoredSession } from "../../../lib/homeData";
import { HomePending } from "../../../pages/Home";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const base = { storedSession: true, homeLoading: false, isLoggedIn: true, hasMealOrCheckup: false, surveyLoading: false, surveyCount: 0, timedOut: false };

describe("P01~P10 decideHomeView", () => {
  it("P01 세션 흔적 없음 · 로딩 중 → visitor(즉시)", () =>
    expect(decideHomeView({ ...base, storedSession: false, homeLoading: true, isLoggedIn: false, surveyLoading: true })).toBe("visitor"));
  it("P02 흔적 있음 · 홈 로딩 중 → pending", () =>
    expect(decideHomeView({ ...base, homeLoading: true, isLoggedIn: false, surveyLoading: true })).toBe("pending"));
  it("P03 로딩 끝 · 로그인 아님 → visitor", () =>
    expect(decideHomeView({ ...base, isLoggedIn: false })).toBe("visitor"));
  it("P04 로그인 · 기록 없음 · 설문 로딩 중 → pending", () =>
    expect(decideHomeView({ ...base, surveyLoading: true })).toBe("pending"));
  it("P05 식사 기록 있음 · 설문 로딩 중 → returning", () =>
    expect(decideHomeView({ ...base, hasMealOrCheckup: true, surveyLoading: true })).toBe("returning"));
  it("P06 기록 없음 · 설문 0 → visitor", () => expect(decideHomeView(base)).toBe("visitor"));
  it("P07 설문 1건 → returning", () => expect(decideHomeView({ ...base, surveyCount: 1 })).toBe("returning"));
  it("P08 홈 로딩 중 + 시간 초과 → 그 시점 정보(visitor)", () =>
    expect(decideHomeView({ ...base, homeLoading: true, isLoggedIn: false, timedOut: true })).toBe("visitor"));
  it("P09 설문 로딩 중 + 시간 초과 → visitor", () =>
    expect(decideHomeView({ ...base, surveyLoading: true, timedOut: true })).toBe("visitor"));
  it("P10 흔적 없음 · 로컬 설문 3건 → visitor(H01 동일)", () =>
    expect(decideHomeView({ ...base, storedSession: false, isLoggedIn: false, surveyCount: 3 })).toBe("visitor"));
});

describe("P11 hasStoredSession", () => {
  const mk = (keys: string[]) => ({ length: keys.length, key: (i: number) => keys[i] ?? null });
  it("Supabase 세션 키 있음 → true", () => expect(hasStoredSession(mk(["sf_session_id", "sb-lrnuqhpgyuizfggxgxpl-auth-token"]))).toBe(true));
  it("다른 키만 → false", () => expect(hasStoredSession(mk(["sf_session_id", "sb-x-code-verifier"]))).toBe(false));
  it("저장소 예외 → false", () =>
    expect(hasStoredSession({ get length(): number { throw new Error("denied"); }, key: () => null })).toBe(false));
  it("저장소 없음 → false", () => expect(hasStoredSession(null)).toBe(false));
});

describe("P12~P14", () => {
  it("P12 HomePending — aria-busy · 방문자/재방문 문구 없음", () => {
    const h = renderToStaticMarkup(<MemoryRouter><HomePending /></MemoryRouter>);
    expect(h).toContain('aria-busy="true"');
    expect(h).toContain("불러오는 중");
    expect(h).not.toMatch(/나부터 시작하기|오늘 끼니|좋은 (아침|오후|저녁)/);
  });
  it("P13 배선 — decideHomeView · pending 이면 배너·본문 대신 자리 표시 · 타이머", () => {
    const s = read("../../../pages/Home.tsx");
    expect(s).toContain("decideHomeView({");
    expect(s).not.toMatch(/\bhomeMode\(/);
    expect(s).toContain("useState(() => hasStoredSession())");
    expect(s).toContain("setTimeout(() => setTimedOut(true), HOME_PENDING_TIMEOUT_MS)");
    const p = s.indexOf("if (mode === 'pending') {");
    expect(p).toBeGreaterThan(0);
    expect(s.indexOf("<HomePending />", p)).toBeGreaterThan(p);
    expect(s.indexOf("{resurvey.prompt && (")).toBeGreaterThan(p); // 배너는 pending 분기 뒤
  });
  it("P14 CSS — 움직임 최소화 설정이면 애니메이션 없음", () => {
    const css = read("../../../styles/global.css");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.home-pending__bar\s*\{\s*animation: none;/);
  });
});
