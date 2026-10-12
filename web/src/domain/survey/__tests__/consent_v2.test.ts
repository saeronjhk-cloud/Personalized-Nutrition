/** 설문 동의 v2 — 순수 로직 + 문구 정본 일치 · 평가 IP/integration/survey_consent_v2_eval_v1.md (A01·A02·A09) */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import * as C from "../consent_v2";

const ST = (o: Partial<C.SurveyConsentStatus> = {}): C.SurveyConsentStatus =>
  ({ has_row: false, active: false, needs_reconsent: false, survey_count: 0, goals_exists: false, consented_at: null, ...o });
const IP = resolve(__dirname, "../../../../../IP/설문동의_고지문안_정본_v1_20261012.md");
const SQL163 = resolve(__dirname, "../../../../supabase/163_survey_consent.sql");

describe("A02 게이트 모드", () => {
  it("비로그인 → anon(메모리 동의, 저장 시 RPC)", () => expect(C.decideSurveyGateMode({ loggedIn: false, status: null })).toBe("anon"));
  it("서버 확인 실패 → error(거짓 통과 금지)", () => expect(C.decideSurveyGateMode({ loggedIn: true, status: null })).toBe("error"));
  it("active → pass", () => expect(C.decideSurveyGateMode({ loggedIn: true, status: ST({ has_row: true, active: true }) })).toBe("pass"));
  it("needs_reconsent → reconsent", () => expect(C.decideSurveyGateMode({ loggedIn: true, status: ST({ has_row: true, needs_reconsent: true }) })).toBe("reconsent"));
  it("J4 동의 행 없이 기존 설문 → migrate(안내 문구 + 재동의, 이관 없음)", () => expect(C.decideSurveyGateMode({ loggedIn: true, status: ST({ survey_count: 3 }) })).toBe("migrate"));
  it("J4 동의 행 없이 목표만 → migrate", () => expect(C.decideSurveyGateMode({ loggedIn: true, status: ST({ goals_exists: true }) })).toBe("migrate"));
  it("철회 후(has_row) 기록이 남아 있어도 migrate 아님 → first", () => expect(C.decideSurveyGateMode({ loggedIn: true, status: ST({ has_row: true, survey_count: 1 }) })).toBe("first"));
  it("철회 후(has_row, 비활성, 재동의 아님) → first", () => expect(C.decideSurveyGateMode({ loggedIn: true, status: ST({ has_row: true }) })).toBe("first"));
});

describe("제출 조건(필수 2개)", () => {
  it.each([[false, false, false], [true, false, false], [false, true, false], [true, true, true]])("pi=%s sensitive=%s → %s", (a, b, e) => {
    expect(C.canSubmitSurveyConsent(a, b)).toBe(e);
  });
});

describe("A09 계정 철회 버튼·상태 문구", () => {
  it("동의 행·설문·목표 중 하나라도 있으면 활성(삭제권)", () => {
    expect(C.surveyRevokeEnabled(ST({ has_row: true }))).toBe(true);
    expect(C.surveyRevokeEnabled(ST({ survey_count: 1 }))).toBe(true);
    expect(C.surveyRevokeEnabled(ST({ goals_exists: true }))).toBe(true);
    expect(C.surveyRevokeEnabled(ST())).toBe(false);
    expect(C.surveyRevokeEnabled(null)).toBe(false);
  });
  it("상태 문구 3종 + 확인 실패", () => {
    expect(C.surveyAccountStatusText(ST({ has_row: true, active: true, consented_at: "2026-10-12T00:30:00Z" })))
      .toBe("설문·건강 목표 정보 이용에 동의하셨어요 (2026년 10월 12일)");
    expect(C.surveyAccountStatusText(ST({ survey_count: 2 }))).toBe(C.ACCOUNT_STATUS_NO_CONSENT);
    expect(C.surveyAccountStatusText(ST())).toBe(C.ACCOUNT_STATUS_NONE);
    expect(C.surveyAccountStatusText(null)).toBe(C.GATE_STATUS_ERROR);
  });
  it("KST 날짜 경계(UTC 15:30 = 다음날 00:30 KST)", () => {
    expect(C.ACCOUNT_STATUS_ACTIVE("2026-10-11T15:30:00Z")).toContain("2026년 10월 12일");
  });
  it("완료 문구 건수", () => expect(C.ACCOUNT_DONE_REVOKE(3)).toBe("설문 동의를 철회했어요. 설문 기록 3건과 건강 목표를 삭제했어요."));
});

describe("A01 문구 = 정본 v1 (복사본 1:1) · 해시 = SQL 163", () => {
  const ip = readFileSync(IP, "utf-8");
  const norm = (t: string) => t.replace(/\*\*/g, "").replace(/\s+/g, " ");
  const N = norm(ip);
  const strings = [
    C.GATE_TITLE, C.GATE_BODY_BEFORE_LINKS, C.GATE_FAMILY_NOTE, C.GATE_CHECK_PI, C.GATE_CHECK_SENSITIVE,
    C.GATE_BTN_ACCEPT, C.GATE_BTN_ACCEPT_GOALS, C.GATE_BTN_DECLINE, C.RECONSENT_TITLE, C.RECONSENT_BODY, C.MIGRATE_TITLE, C.MIGRATE_BODY,
    C.GATE_SUBMIT_ERROR, C.GATE_STATUS_ERROR, C.ACCOUNT_STATUS_NO_CONSENT, C.ACCOUNT_STATUS_NONE,
    C.ACCOUNT_BTN_REVOKE, C.ACCOUNT_CONFIRM_REVOKE, C.ACCOUNT_CONFIRM_OK, C.ACCOUNT_REVOKE_ERROR,
  ];
  it.each(strings.map((s) => [s.slice(0, 24), s]))("%s…", (_k, s) => expect(N).toContain(norm(s)));
  it("§1 sha256 = SQL 163 notice_hash", () => {
    const block = ip.split("<!-- BEGIN §1 -->")[1].split("<!-- END §1 -->")[0].trim();
    const h = createHash("sha256").update(block, "utf8").digest("hex");
    expect(readFileSync(SQL163, "utf-8")).toContain(`'${C.SURVEY_NOTICE_VERSION}', '${C.SURVEY_POLICY_VERSION}', '${h}'`);
  });
});
