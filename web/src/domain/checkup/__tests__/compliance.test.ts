import { describe, it, expect } from "vitest";
import {
  ALLOWED_TONE_TEMPLATES,
  BANNED_WORDS,
  SAFE_TONE_FALLBACK,
  checkCompliance,
  resolveToneBody,
} from "../compliance";

describe("checkCompliance", () => {
  it("모든 ALLOWED_TONE_TEMPLATES 문구는 통과", () => {
    for (const text of Object.values(ALLOWED_TONE_TEMPLATES)) {
      expect(checkCompliance(text)).toBe(true);
    }
  });

  it("SAFE_TONE_FALLBACK은 통과", () => {
    expect(checkCompliance(SAFE_TONE_FALLBACK)).toBe(true);
  });

  it("금지어가 포함되면 false", () => {
    for (const word of BANNED_WORDS) {
      expect(checkCompliance(`안내 문구 ${word} 포함`)).toBe(false);
    }
  });

  it("중립 문구는 true", () => {
    expect(checkCompliance("현재 수치를 참고하세요.")).toBe(true);
  });
});

describe("resolveToneBody", () => {
  it("허용 tone → 해당 템플릿", () => {
    expect(resolveToneBody("유지")).toBe(ALLOWED_TONE_TEMPLATES.유지);
  });

  it("알 수 없는 tone → null", () => {
    expect(resolveToneBody("unknown_tone")).toBeNull();
  });

  it("null tone → null", () => {
    expect(resolveToneBody(null)).toBeNull();
  });
});
