/**
 * 한식 끼니 문법 P1 — 음식 이름 → 역할(role) 해석 (순수 · 엔진 내부 결정론, 원칙5)
 *
 * 설계: IP/integration/meal_grammar_p1_design_v1.md §1·§2 · 평가: IP/integration/meal_grammar_p1_eval_v1.md R·D
 * 사전 정본: IP/meal_role_dictionary_v1.json (원칙3) — 이 폴더의 JSON 은 바이트 동일 복사본(D01).
 *   재생성: python tools/gen_meal_role_dictionary.py → cp IP/meal_role_dictionary_v1.json web/src/domain/coaching/
 * 의미론은 생성기(apply_rules)와 동일: 정확 일치 entries 우선 → 아니면 rules 전부 합집합 → OTHER 는 단독일 때만 → 없으면 UNKNOWN.
 * ⚠ IO import 금지(W3).
 */
import dict from "./meal_role_dictionary_v1.json";

export const ROLES = [
  "RICE", "NOODLE", "GRAIN_OTHER", "PROTEIN", "VEG", "KIMCHI", "PICKLE", "BROTH",
  "ALCOHOL", "SNACK_SWEET", "FRUIT", "BEVERAGE", "OTHER", "UNKNOWN",
] as const;
export type Role = (typeof ROLES)[number];

export interface RoleRule { m: "c" | "e"; p: string; r: Role[]; u?: string[] }
export interface RoleDictionary { version: string; entries: Record<string, Role[]>; rules: RoleRule[] }

export const MEAL_ROLE_DICTIONARY = dict as unknown as RoleDictionary;

const ORDER = new Map<Role, number>(ROLES.map((r, i) => [r, i]));

/** NFC · 괄호 안 제거 · 공백 제거 · 영문 소문자 (생성기 norm 과 동일) */
export function normalizeFoodName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.normalize("NFC").replace(/\([^)]*\)/g, "").replace(/\s+/g, "").toLowerCase();
}

export function applyRoleRules(n: string, rules: readonly RoleRule[] = MEAL_ROLE_DICTIONARY.rules): Role[] {
  if (!n) return [];
  const out = new Set<Role>();
  for (const r of rules) {
    const hit = r.m === "c" ? n.includes(r.p) : n.endsWith(r.p);
    if (hit && !(r.u ?? []).some((u) => n.includes(u))) r.r.forEach((x) => out.add(x));
  }
  if (out.size > 1) out.delete("OTHER");
  return [...out].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

/** 음식 이름 → role 목록(정렬, 최소 1개). 모르면 ['UNKNOWN']. */
export function resolveRoles(name: unknown, d: RoleDictionary = MEAL_ROLE_DICTIONARY): Role[] {
  const n = normalizeFoodName(name);
  if (!n) return ["UNKNOWN"];
  const e = d.entries[n];
  if (e && e.length > 0) return [...e];
  const r = applyRoleRules(n, d.rules);
  return r.length > 0 ? r : ["UNKNOWN"];
}
