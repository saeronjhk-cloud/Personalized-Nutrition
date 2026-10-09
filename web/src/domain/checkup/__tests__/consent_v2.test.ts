/** 검진 동의 v2 — 순수 로직 + 문구 정본 일치 · 평가 IP/integration/checkup_consent_v2_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as C from "../consent_v2";

const ST = (o: Partial<C.CheckupConsentStatus> = {}): C.CheckupConsentStatus =>
  ({ has_row: false, core_active: false, combine_active: false, needs_reconsent: false, record_count: 0, ...o });

describe("게이트 모드(A05~A07)", () => {
  it("A07 비로그인 → login", () => expect(C.decideGateMode({ loggedIn: false, status: null, legacyLocalConsent: false })).toBe("login"));
  it("서버 확인 실패 → error(거짓 통과 금지)", () => expect(C.decideGateMode({ loggedIn: true, status: null, legacyLocalConsent: true })).toBe("error"));
  it("A06 core_active → pass", () => expect(C.decideGateMode({ loggedIn: true, status: ST({ has_row: true, core_active: true }), legacyLocalConsent: false })).toBe("pass"));
  it("A05 옛 localStorage 동의만 → reconsent", () => expect(C.decideGateMode({ loggedIn: true, status: ST(), legacyLocalConsent: true })).toBe("reconsent"));
  it("A05 서버 needs_reconsent(문구 버전 변경) → reconsent", () => expect(C.decideGateMode({ loggedIn: true, status: ST({ has_row: true, needs_reconsent: true }), legacyLocalConsent: false })).toBe("reconsent"));
  it("A05 동의 없이 기존 기록 보유 → reconsent", () => expect(C.decideGateMode({ loggedIn: true, status: ST({ record_count: 1 }), legacyLocalConsent: false })).toBe("reconsent"));
  it("처음 → first", () => expect(C.decideGateMode({ loggedIn: true, status: ST(), legacyLocalConsent: false })).toBe("first"));
});

describe("A02 제출 조건", () => {
  it.each([[false, false, false], [true, false, false], [false, true, false], [true, true, true]])("core=%s age=%s → %s", (c, a, e) => {
    expect(C.canSubmitConsent(c, a)).toBe(e);
  });
});

describe("계정 철회 버튼(A09~A11)", () => {
  it("A09 결합 활성일 때만 철회 A", () => {
    expect(C.accountRevokeState(ST({ has_row: true, core_active: true, combine_active: true })).showCombineRevoke).toBe(true);
    expect(C.accountRevokeState(ST({ has_row: true, core_active: true })).showCombineRevoke).toBe(false);
  });
  it("A10 동의 행 또는 기록이 있으면 철회 B 활성(옛 동의 보유자 삭제권)", () => {
    expect(C.accountRevokeState(ST({ has_row: true })).coreRevokeEnabled).toBe(true);
    expect(C.accountRevokeState(ST({ record_count: 2 })).coreRevokeEnabled).toBe(true);
  });
  it("A11 둘 다 없음 → 비활성", () => {
    expect(C.accountRevokeState(ST())).toEqual({ showCombineRevoke: false, coreRevokeEnabled: false });
    expect(C.accountRevokeState(null)).toEqual({ showCombineRevoke: false, coreRevokeEnabled: false });
  });
});

describe("A01 문구 = 정본 v2 §1·§4·§5 (복사본 1:1)", () => {
  const ip = readFileSync(resolve(__dirname, "../../../../../IP/검진동의_고지문안_정본_v2_20261007.md"), "utf-8");
  const norm = (t: string) => t.replace(/\*\*/g, "").replace(/\s+/g, " ");
  const N = norm(ip);
  const strings = [
    C.GATE_TITLE, C.GATE_CORE_INTRO, ...C.GATE_CORE_BULLETS, C.GATE_CHECK_CORE, C.GATE_CHECK_AGE,
    ...C.GATE_COMBINE_BULLETS, C.GATE_CHECK_COMBINE, C.GATE_BTN_ACCEPT, C.GATE_BTN_DECLINE,
    C.RECONSENT_TITLE, C.RECONSENT_BODY, C.ACCOUNT_BTN_COMBINE, C.ACCOUNT_DONE_COMBINE,
    C.ACCOUNT_BTN_CORE, C.ACCOUNT_CONFIRM_CORE, C.ACCOUNT_DONE_CORE, C.ACCOUNT_NONE,
  ];
  it.each(strings.map((s) => [s.slice(0, 24), s]))("%s…", (_k, s) => {
    expect(N).toContain(norm(s));
  });
  it("작은 글씨: 정본 앞 두 문장 일치(조항 표기만 실제 단락명으로 구체화)", () => {
    const first2 = C.GATE_SMALL_PRINT.split(". ").slice(0, 2).join(". ");
    expect(N).toContain(norm(first2));
  });
  it("버전 상수 = SQL 161 싱글턴 초기값", () => {
    const sql = readFileSync(resolve(__dirname, "../../../../supabase/161_checkup_consent.sql"), "utf-8");
    expect(sql).toContain(`'${C.CHECKUP_NOTICE_VERSION}', '${C.CHECKUP_POLICY_VERSION}'`);
  });
});
