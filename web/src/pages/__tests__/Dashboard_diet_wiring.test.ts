/**
 * Phase H 구조 가드 — «내 건강» 🥗 식이 카드 (H11·H12)
 * 렌더 테스트 대신 소스 검사: 라우터·Supabase 목킹 없이 «입구가 열려 있고, 판정을 한 곳에서 한다»만 지킨다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "../Dashboard.tsx"), "utf-8");
const start = src.indexOf("{/* 식이");
const end = src.indexOf("{/* 운동");
const card = src.slice(start, end);
// MEAL 꺼짐 분기(종전 카드)는 설명 «식사 패턴…» 으로 시작 — 그 앞까지가 켜짐 분기
const offStart = card.indexOf('desc="식사 패턴');
const onBranch = card.slice(0, offStart);

describe("Phase H — Dashboard 식이 카드 배선", () => {
  it("H11 MEAL 켜짐 분기: /meal·/weekly-report 이동, disabled 없음, dietCardStatus 로 판정", () => {
    expect(start).toBeGreaterThan(0);
    expect(card).toContain("MEAL_ENABLED ?");
    expect(offStart).toBeGreaterThan(0);
    expect(onBranch).toContain('navigate("/meal")');
    expect(onBranch).toContain('navigate("/weekly-report")');
    expect(onBranch).not.toMatch(/\bdisabled\b/);
    expect(onBranch).toContain("dietCardStatus(");
    expect(src).toContain("loadRecentMealDays(");
  });

  it("H12 미구현 식이 코칭 표현 없음", () => {
    expect(card).not.toMatch(/식이 가이드|식단 코칭|식사 조언을 (드려|제공)/);
  });
});
