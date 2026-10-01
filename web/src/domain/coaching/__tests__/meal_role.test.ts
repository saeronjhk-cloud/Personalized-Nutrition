/**
 * 한식 끼니 문법 P1 — role 해석·사전 평가셋 (R01~R50 · D01~D03) — Eval-First
 * 정본: IP/integration/meal_grammar_p1_eval_v1.md · 사전 정본: IP/meal_role_dictionary_v1.json
 * 사전 v2 는 이 표에 케이스를 먼저 추가한 뒤 고친다(케이스 삭제 금지).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveRoles, normalizeFoodName, ROLES, MEAL_ROLE_DICTIONARY } from "../meal_role";

const R: [string, string, string][] = [
  ["R01", "쌀밥", "RICE"],
  ["R02", "흰밥", "RICE"],
  ["R03", "잡곡밥", "RICE"],
  ["R04", "제육덮밥", "RICE,PROTEIN"],
  ["R05", "순대국밥", "RICE,PROTEIN,BROTH"],
  ["R06", "김치찌개", "BROTH"],
  ["R07", "돼지고기김치찌개", "PROTEIN,BROTH"],
  ["R08", "된장찌개", "BROTH"],
  ["R09", "순두부찌개", "PROTEIN,BROTH"],
  ["R10", "콩나물국", "VEG,BROTH"],
  ["R11", "배추김치", "KIMCHI"],
  ["R12", "깍두기", "KIMCHI"],
  ["R13", "김치", "KIMCHI"],
  ["R14", "시금치나물", "VEG"],
  ["R15", "상추", "VEG"],
  ["R16", "연어 샐러드", "PROTEIN,VEG"],
  ["R17", "삶은 달걀", "PROTEIN"],
  ["R18", "계란찜", "PROTEIN"],
  ["R19", "생선 튀김", "PROTEIN"],
  ["R20", "돈까스", "PROTEIN"],
  ["R21", "떡갈비", "PROTEIN"],
  ["R22", "떡볶이", "GRAIN_OTHER"],
  ["R23", "탕수육", "PROTEIN"],
  ["R24", "고구마맛탕", "SNACK_SWEET"],
  ["R25", "라면", "NOODLE"],
  ["R26", "치즈라면", "NOODLE"],
  ["R27", "유부초밥", "RICE"],
  ["R28", "김밥", "RICE"],
  ["R29", "참치김밥", "RICE,PROTEIN"],
  ["R30", "오이소박이", "KIMCHI"],
  ["R31", "단무지", "PICKLE"],
  ["R32", "우유", "PROTEIN"],
  ["R33", "아메리카노", "BEVERAGE"],
  ["R34", "콜라", "SNACK_SWEET"],
  ["R35", "소주", "ALCOHOL"],
  ["R36", "감자볶음", "OTHER"],
  ["R37", "호박 퓨레", "VEG"],
  ["R38", "양배추", "VEG"],
  ["R39", "족발", "PROTEIN"],
  ["R40", "어묵탕", "PROTEIN,BROTH"],
  ["R41", "매운탕", "PROTEIN,BROTH"],
  ["R42", "스테이크 덮밥", "RICE,PROTEIN"],
  ["R43", " 쌀밥 (1공기) ", "RICE"],
  ["R44", "모둠반찬", "UNKNOWN"],
  ["R45", "", "UNKNOWN"],
  ["R47", "김치볶음밥", "RICE"],
  ["R48", "두부김치", "PROTEIN,KIMCHI"],
  ["R49", "샌드위치", "GRAIN_OTHER"],
  ["R50", "미역국", "BROTH"],
];

const sorted = (a: readonly string[]) => [...a].sort();

describe("R role 해석", () => {
  for (const [id, name, exp] of R) {
    it(`${id} ${JSON.stringify(name)} → ${exp}`, () => {
      expect(sorted(resolveRoles(name))).toEqual(sorted(exp.split(",")));
    });
  }
  it("R46 바나나우유 ⊇ PROTEIN", () => {
    expect(resolveRoles("바나나우유")).toContain("PROTEIN");
  });
  it("비문자열 입력 → UNKNOWN", () => {
    expect(resolveRoles(null)).toEqual(["UNKNOWN"]);
    expect(resolveRoles(42)).toEqual(["UNKNOWN"]);
  });
});

describe("D 사전 무결성", () => {
  it("D01 코드 복사본 = IP 정본 (바이트 동일, IP 없으면 skip)", () => {
    const ip = resolve(__dirname, "../../../../../IP/meal_role_dictionary_v1.json");
    const code = resolve(__dirname, "../meal_role_dictionary_v1.json");
    if (!existsSync(ip)) return;
    expect(readFileSync(code, "utf-8")).toBe(readFileSync(ip, "utf-8"));
  });
  it("D02 role 은 정의된 집합 · 정규화 키 중복 0", () => {
    const valid = new Set<string>(ROLES);
    const keys = Object.keys(MEAL_ROLE_DICTIONARY.entries);
    for (const k of keys) {
      expect(normalizeFoodName(k)).toBe(k);
      for (const r of MEAL_ROLE_DICTIONARY.entries[k]) expect(valid.has(r)).toBe(true);
    }
    for (const r of MEAL_ROLE_DICTIONARY.rules) for (const x of r.r) expect(valid.has(x)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("D03 AI Hub 400 시드 entries 전부 UNKNOWN 아님", () => {
    const keys = Object.keys(MEAL_ROLE_DICTIONARY.entries);
    expect(keys.length).toBeGreaterThanOrEqual(380);
    for (const k of keys) expect(resolveRoles(k)).not.toContain("UNKNOWN");
  });
});
