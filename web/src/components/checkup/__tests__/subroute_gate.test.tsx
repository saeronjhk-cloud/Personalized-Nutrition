/** 검진 하위 화면 동의 게이트 — G01~G16 · 평가 IP/integration/checkup_subroute_gate_eval_v1.md
 *  jsdom 미도입 원칙 → 상태 결정은 의존성 주입, 화면은 정적 렌더 문자열, 배선은 소스 검사. */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../lib/supabase", () => ({ supabase: { auth: { getUser: vi.fn() }, rpc: vi.fn() } }));

import { resolveCheckupGateMode } from "../../../lib/checkupGate";
import { CheckupGateView, type CheckupGateViewMode } from "../CheckupConsentRoute";
import {
  GATE_LOGIN_REQUIRED, GATE_STATUS_ERROR, GATE_TITLE, RECONSENT_TITLE, type CheckupConsentStatus,
} from "../../../domain/checkup/consent_v2";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const st = (o: Partial<CheckupConsentStatus>): CheckupConsentStatus => ({
  has_row: false, core_active: false, combine_active: false, needs_reconsent: false, record_count: 0, ...o,
});

describe("G01~G07 resolveCheckupGateMode", () => {
  it("G01 비로그인 → login · 상태 RPC 호출 0", async () => {
    const fetchStatus = vi.fn();
    expect(await resolveCheckupGateMode({ isLoggedIn: async () => false, fetchStatus })).toBe("login");
    expect(fetchStatus).not.toHaveBeenCalled();
  });
  it("G02 서버 실패(null) → error", async () => {
    expect(await resolveCheckupGateMode({ isLoggedIn: async () => true, fetchStatus: async () => null })).toBe("error");
  });
  it("G03 getUser 예외 → error(통과 아님)", async () => {
    expect(await resolveCheckupGateMode({ isLoggedIn: async () => { throw new Error("x"); }, fetchStatus: async () => st({ core_active: true }) })).toBe("error");
  });
  it("G04 상태 RPC 예외 → error", async () => {
    expect(await resolveCheckupGateMode({ isLoggedIn: async () => true, fetchStatus: async () => { throw new Error("x"); } })).toBe("error");
  });
  it("G05 core_active → pass", async () => {
    expect(await resolveCheckupGateMode({ isLoggedIn: async () => true, fetchStatus: async () => st({ has_row: true, core_active: true }) })).toBe("pass");
  });
  it("G06 재동의 대상(기록 3건) → reconsent", async () => {
    expect(await resolveCheckupGateMode({ isLoggedIn: async () => true, fetchStatus: async () => st({ has_row: true, needs_reconsent: true, record_count: 3 }) })).toBe("reconsent");
  });
  it("G07 동의 행 없음 → first", async () => {
    expect(await resolveCheckupGateMode({ isLoggedIn: async () => true, fetchStatus: async () => st({}) })).toBe("first");
  });
});

describe("G08~G13 CheckupGateView", () => {
  const CHILD = "CHILD-RECORD-LIST";
  const render = (mode: CheckupGateViewMode) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <CheckupGateView mode={mode} onLogin={() => {}} onRetry={() => {}} onAccept={async () => {}} onDecline={() => {}}>
          <div>{CHILD}</div>
        </CheckupGateView>
      </MemoryRouter>,
    );
  it("G08 loading — 자식 미렌더", () => {
    const h = render("loading");
    expect(h).not.toContain(CHILD);
    expect(h).toContain('data-testid="checkup-gate-loading"');
  });
  it("G09 login — 자식 미렌더 · 로그인 문구", () => {
    const h = render("login");
    expect(h).not.toContain(CHILD);
    expect(h).toContain('data-testid="checkup-gate-login"');
    expect(h).toContain(GATE_LOGIN_REQUIRED);
  });
  it("G10 error — 자식 미렌더 · 다시 시도", () => {
    const h = render("error");
    expect(h).not.toContain(CHILD);
    expect(h).toContain('data-testid="checkup-gate-error"');
    expect(h).toContain(GATE_STATUS_ERROR);
    expect(h).toContain("다시 시도");
  });
  it("G11 first — 자식 미렌더 · 동의 게이트 · 사전 체크 0 · 재동의 안내 없음", () => {
    const h = render("first");
    expect(h).not.toContain(CHILD);
    expect(h).toContain(GATE_TITLE);
    const boxes = h.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(boxes).toHaveLength(3);
    for (const b of boxes) expect(b).not.toMatch(/checked/);
    expect(h).not.toContain(RECONSENT_TITLE);
  });
  it("G12 reconsent — 자식 미렌더 · 재동의 안내", () => {
    const h = render("reconsent");
    expect(h).not.toContain(CHILD);
    expect(h).toContain(RECONSENT_TITLE);
  });
  it("G13 pass — 자식만 렌더 · 게이트 문구 0", () => {
    const h = render("pass");
    expect(h).toBe(`<div>${CHILD}</div>`);
  });
});

describe("G14~G16 배선", () => {
  it("G14 App.tsx — 검진 4개 라우트 모두 CheckupConsentRoute 로 감쌈", () => {
    const s = read("../../../App.tsx");
    const routes = s.match(/<Route path="\/checkup[^"]*" element=\{[^\n]*\} \/>/g) ?? [];
    expect(routes).toHaveLength(4);
    for (const r of routes) expect(r).toMatch(/element=\{<CheckupConsentRoute><\w+ \/><\/CheckupConsentRoute>\}/);
    for (const p of ['"/checkup"', '"/checkup/manage"', '"/checkup/edit/:recordId"', '"/checkup/view/:recordId"']) {
      expect(routes.some((r) => r.includes(`path=${p}`))).toBe(true);
    }
  });
  it("G15 Checkup.tsx — 인라인 게이트 제거", () => {
    const s = read("../../../pages/Checkup.tsx");
    for (const t of ["decideGateMode", "giveCheckupConsent", "fetchCheckupConsentStatus", "CheckupConsentGate"]) {
      expect(s).not.toContain(t);
    }
  });
  it("G16 래퍼 — 서버 기록 후 재조회 · 거부 → 홈 · localStorage 0", () => {
    const s = read("../CheckupConsentRoute.tsx");
    const a = s.indexOf("await giveCheckupConsent(core, age14, combine);");
    expect(a).toBeGreaterThan(0);
    expect(s.indexOf("await refresh();", a)).toBeGreaterThan(a);
    expect(s).toContain('onDecline={() => navigate("/")}');
    expect(s).toContain("resolveCheckupGateMode()");
    expect(s).not.toMatch(/localStorage|sessionStorage/);
    expect(read("../../../lib/checkupGate.ts")).not.toMatch(/localStorage|sessionStorage/);
  });
});
