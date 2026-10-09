/** 검진 동의 v2 게이트 렌더 — A01·A02(초기)·A05 · 평가 IP/integration/checkup_consent_v2_eval_v1.md
 *  jsdom 미도입 원칙(AllergenCard_notice 참조) → 정적 렌더 문자열로 단정. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import CheckupConsentGate from "../CheckupConsentGate";
import { GATE_TITLE, GATE_CHECK_CORE, GATE_CHECK_AGE, GATE_CHECK_COMBINE, RECONSENT_TITLE } from "../../domain/checkup/consent_v2";

const render = (mode: "first" | "reconsent") =>
  renderToStaticMarkup(<MemoryRouter><CheckupConsentGate mode={mode} onAccept={async () => {}} onDecline={() => {}} /></MemoryRouter>);

describe("CheckupConsentGate v2", () => {
  const html = render("first");
  it("A01 제목·체크 3개 문구", () => {
    for (const t of [GATE_TITLE, GATE_CHECK_CORE, GATE_CHECK_AGE, GATE_CHECK_COMBINE]) expect(html).toContain(t);
  });
  it("A01 사전 체크 금지 — checked 속성 0", () => {
    const boxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(boxes).toHaveLength(3);
    for (const b of boxes) expect(b).not.toMatch(/checked/);
  });
  it("A02 초기 동의 버튼 disabled", () => {
    expect(html).toMatch(/<button[^>]*data-testid="checkup-consent-accept"[^>]*disabled/);
  });
  it("A05 first 에는 재동의 안내 없음 · reconsent 에는 있음", () => {
    expect(html).not.toContain(RECONSENT_TITLE);
    expect(render("reconsent")).toContain(RECONSENT_TITLE);
  });
});
