/** 검진 임시 조치 v1 P01 · 정본 IP/integration/checkup_interim_pause_eval_v1.md */
import { describe, it, expect } from "vitest";
import { CHECKUP_SAVE_PAUSED, CHECKUP_COMBINE_PAUSED, PAUSE_NOTICE, PAUSE_SAVE_ERROR } from "../interim_pause";
import { BANNED_WORDS } from "../compliance";

describe("임시 조치 v1", () => {
  it("P01 플래그·문구", () => {
    expect(CHECKUP_SAVE_PAUSED).toBe(true);
    expect(CHECKUP_COMBINE_PAUSED).toBe(true);
    expect(PAUSE_NOTICE).toBe("검진 기록 저장은 개인정보 처리 절차를 정비하는 동안 잠시 멈췄어요. 분석 결과는 지금처럼 이 화면에서 볼 수 있고, 입력한 수치는 서버에 저장되지 않아요. 저장해 둔 기록은 보기와 삭제만 할 수 있어요.");
    expect(PAUSE_SAVE_ERROR).toBe("지금은 검진 기록을 저장할 수 없어요(처리 절차 정비 중).");
    for (const w of BANNED_WORDS) { expect(PAUSE_NOTICE).not.toContain(w); expect(PAUSE_SAVE_ERROR).not.toContain(w); }
  });
});
