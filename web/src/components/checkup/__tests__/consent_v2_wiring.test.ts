/** 검진 동의 v2 배선 — A04·A08·A09·A10·A12·A13·A14 · 평가 IP/integration/checkup_consent_v2_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("동의 v2 배선", () => {
  it("A08 통합 로더: 임시 조치 가드 다음 줄에 결합 동의 서버 확인", () => {
    const s = read("../../../lib/loadUnifiedInputs.ts");
    const a = s.indexOf("if (!plan.checkup || CHECKUP_COMBINE_PAUSED) return null;");
    const b = s.indexOf("if (!(await isCheckupCombineActive(userId))) return null;");
    const c = s.indexOf("await fetchCheckupRecords(userId)");
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b);
  });
  it("A08 코칭 로더 동일", () => {
    const s = read("../../../lib/goalCoaching.ts");
    const b = s.indexOf("if (!(await isCheckupCombineActive(userId))) return null");
    expect(b).toBeGreaterThan(s.indexOf("CHECKUP_COMBINE_PAUSED) return null"));
    expect(s.indexOf("const recs = await fetchCheckupRecords(userId)")).toBeGreaterThan(b);
  });
  it("A04 Checkup: 서버 기록 성공 후에만 진입(로컬 캐시 기록 없음)", () => {
    const s = read("../../../pages/Checkup.tsx");
    expect(s).toContain("await giveCheckupConsent(core, age14, combine);");
    expect(s).not.toContain("markCheckupConsent");
    expect(s).toContain("decideGateMode(");
  });
  it("A09·A10 계정 화면 철회 2개 + 확인 대화상자", () => {
    const s = read("../../../pages/Account.tsx");
    expect(s).toContain('data-testid="checkup-revoke-combine"');
    expect(s).toContain('data-testid="checkup-revoke-core"');
    expect(s).toContain("description={ACCOUNT_CONFIRM_CORE}");
    expect(s.indexOf("{rs.showCombineRevoke && (")).toBeLessThan(s.indexOf('data-testid="checkup-revoke-combine"'));
  });
  it("A12 처리방침 13_v5.1", () => {
    const s = read("../../../pages/Privacy.tsx");
    expect(s).not.toContain("향후 도입 예정");
    expect(s).toContain("건강검진 정보(민감정보)의 별도 동의");
    expect(s).toContain("건강검진 수치·해석 결과(검진 기능 이용 시)");
    expect(s).toContain("버전 13_v5.1");
    expect(s).toContain("식사 사진·건강검진 동의 증빙(최소 메타)");
  });
  it("A13 약관", () => {
    const s = read("../../../pages/Terms.tsx");
    expect(s).not.toContain("향후 Phase C");
    expect(s).toContain("타인의 건강검진 결과를 그 사람의 동의 없이 입력해서는 안 되며");
  });
  it("A14 임시 조치 상수는 아직 true(해제는 실측 후 별도 커밋)", () => {
    const s = read("../../../domain/checkup/interim_pause.ts");
    expect(s).toContain("export const CHECKUP_SAVE_PAUSED = true;");
    expect(s).toContain("export const CHECKUP_COMBINE_PAUSED = true;");
  });
  it("SQL 161 핵심(RESTRICTIVE·RPC 전용 쓰기·감사 3년·160 되돌리기 주석만)", () => {
    const s = read("../../../../supabase/161_checkup_consent.sql");
    const body = s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(body).toMatch(/as restrictive for all to authenticated, anon/g);
    expect(body).toContain("grant select on public.checkup_consent to authenticated;");
    expect(body).not.toMatch(/grant (insert|update)[^;]*checkup_consent to/);
    expect(body).toContain("interval '3 years'");
    expect(body).not.toMatch(/^\s*grant insert on table public\.checkup_records/im);
  });
});
