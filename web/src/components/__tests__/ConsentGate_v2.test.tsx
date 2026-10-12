/** 설문 동의 v2 게이트 렌더 — A01·A02 · 평가 IP/integration/survey_consent_v2_eval_v1.md (정적 렌더) */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ConsentGate from "../ConsentGate";
import * as C from "../../domain/survey/consent_v2";

const render = (mode: "first" | "reconsent" | "anon", acceptLabel?: string) =>
  renderToStaticMarkup(<MemoryRouter><ConsentGate mode={mode} acceptLabel={acceptLabel} onAccept={async () => {}} onDecline={() => {}} /></MemoryRouter>);

describe("ConsentGate v2(설문)", () => {
  const html = render("first");
  it("A01 정본 문구(제목·본문·가족력·체크 2개·버튼)", () => {
    for (const t of [C.GATE_TITLE, C.GATE_BODY_BEFORE_LINKS, C.GATE_FAMILY_NOTE, C.GATE_CHECK_PI, C.GATE_CHECK_SENSITIVE, C.GATE_BTN_ACCEPT, C.GATE_BTN_DECLINE])
      expect(html).toContain(t);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
  });
  it("A01 사전 체크 금지 — 체크박스 2개, checked 0", () => {
    const boxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(boxes).toHaveLength(2);
    for (const b of boxes) expect(b).not.toMatch(/checked/);
  });
  it("A02 초기 동의 버튼 disabled", () => {
    expect(html).toMatch(/<button[^>]*data-testid="survey-consent-accept"[^>]*disabled/);
  });
  it("재동의 안내는 reconsent 에만", () => {
    expect(html).not.toContain(C.RECONSENT_TITLE);
    expect(render("anon")).not.toContain(C.RECONSENT_TITLE);
    expect(render("reconsent")).toContain(C.RECONSENT_TITLE);
  });
  it("A04 목표 카드 라벨", () => expect(render("first", C.GATE_BTN_ACCEPT_GOALS)).toContain(C.GATE_BTN_ACCEPT_GOALS));
});
