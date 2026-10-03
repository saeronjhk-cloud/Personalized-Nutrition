/**
 * 코칭 사전 시뮬레이션 v1 — 운영 meal_log 익명 추출(IP/integration/sim/sim_export_v1.sql)을 «실제 도메인 코드» 로 재생
 * 실행: cd web && TZ=Asia/Seoul node_modules/.bin/vite-node ../tools/sim_coaching_v1.ts -- <csv> [out.md]
 * 출력: 사용자·일 단위 발화율 · 규칙별 실패율 · 졸업 · v1(g) vs G-PRO 불일치 · P2(병목) 가 고정 순서와 다른 날 비율
 * 옵션 --legacy: v1 단백질 카드를 D-SIM1 이전(g 단독 판정)으로 재생해 비교.
 * 원칙: 판정 로직을 다시 짜지 않는다 — meal_grammar.ts · goal_meal_coaching.ts 를 그대로 호출(원칙5·결과 동일성).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { mealGrammarCoaching, mealsFromRows, judgeMeal, localDayKey, proteinRoleBySlot, type GrammarMealRow } from "../web/src/domain/coaching/meal_grammar";
import { DEFAULT_MEAL_GRAMMAR_PARAMS, type GrammarRuleId } from "../web/src/domain/coaching/meal_grammar_params";
import { goalMealCoaching, mealRowsToCoachMeals, perMealTargetG } from "../web/src/domain/coaching/goal_meal_coaching";
import { DEFAULT_GOAL_COACHING_PARAMS } from "../web/src/domain/coaching/goal_coaching_params";
import { trustedBody } from "../web/src/domain/survey/body_input";

const LEGACY = process.argv.includes("--legacy");

// ── CSV (RFC4180 최소 구현: 따옴표·이스케이프·줄바꿈 포함 필드) ──
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let f = ""; let row: string[] = []; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  const [h, ...b] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k.replace(/^﻿/, ""), r[i] ?? ""])));
}
const num = (s: string) => (s === "" || s == null ? null : Number.isFinite(Number(s)) ? Number(s) : null);
const bool = (s: string) => s === "true" || s === "t";
const jparse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

// 운영 로더와 같은 입력(규칙 33): 초기값(170/65/30) 의심 기록은 신체값 미상 — survey_initial_values_eval_v1
function simBody(weight: number | null, height: number | null, age: number | null) {
  const t = trustedBody({ 체중: weight ?? undefined, 신장: height ?? undefined, 나이: age ?? undefined });
  return { weight: t.weightKg, height: t.heightCm, age: t.age };
}

interface U { rows: (GrammarMealRow & { protein_g: number | null })[]; goals: string[]; weight: number | null; height: number | null; age: number | null; cond: boolean; egfrLow: boolean }

export function simulate(recs: Record<string, string>[]) {
  const users = new Map<string, U>();
  for (const r of recs) {
    const u = users.get(r.u) ?? { rows: [], goals: (jparse(r.goals) as string[]) ?? [], ...simBody(num(r.weight_kg), num(r.height_cm), num(r.age)), cond: bool(r.cond_excluded), egfrLow: bool(r.egfr_low) };
    u.rows.push({ eaten_at: `${r.eaten_kst}:00+09:00`, meal_slot: r.meal_slot || null, foods: jparse(r.foods), protein_g: num(r.protein_g) });
    users.set(r.u, u);
  }
  const RULES: GrammarRuleId[] = ["G-PRO", "G-VEG", "G-AM"];
  const t = { users: users.size, userDays: 0, daysActive: 0, daysMaint: 0, v1Days: 0, blockedDays: 0, byRule: { "G-PRO": 0, "G-VEG": 0, "G-AM": 0 } as Record<GrammarRuleId, number>,
    p2Diff: 0, p2Days: 0, gradUsers: new Set<string>(), mealV1G: { both: 0, v1only: 0, gonly: 0, neither: 0 }, usersWithCard: new Set<string>() };
  for (const [id, u] of users) {
    const days = [...new Set(u.rows.map((r) => localDayKey(new Date(r.eaten_at))))].sort();
    const conditions = u.cond ? ["신장질환"] : [];
    const egfr = u.egfrLow ? 50 : null;
    for (const d of days) {
      const now = new Date(`${d}T21:00:00+09:00`);
      const upto = u.rows.filter((r) => new Date(r.eaten_at).getTime() <= now.getTime());
      const today = upto.filter((r) => localDayKey(new Date(r.eaten_at)) === d);
      const v1 = goalMealCoaching({ mealEnabled: true, loggedIn: true, goals: u.goals, weightKg: u.weight, heightCm: u.height, age: u.age, conditions, egfr,
        meals: mealRowsToCoachMeals(today.map((r) => ({ eaten_at: r.eaten_at, meal_slot: r.meal_slot, summary: { total_protein_g: r.protein_g } }))),
        // 운영 로더와 동일(D-SIM1): 단백질 반찬 «없음» 끼니만 g 판정. --legacy 면 종전 v1
        proteinRoleBySlot: LEGACY ? undefined : proteinRoleBySlot(today, now) });
      const v1Visible = v1.cards.length > 0;
      const base = { mealEnabled: true, loggedIn: true, rows: upto, now, conditions, egfr, v1CardVisible: v1Visible };
      const g = mealGrammarCoaching(base);
      t.userDays++;
      if (v1Visible) t.v1Days++;
      if (g.blocked_reason) t.blockedDays++;
      if (g.active) { t.daysActive++; t.byRule[g.active.rule]++; t.usersWithCard.add(id); }
      if (v1Visible) t.usersWithCard.add(id);
      if (g.maintenance) { t.daysMaint++; t.gradUsers.add(id); }
      // P2 비교: 오늘 후보(각 규칙을 맨 앞에 둔 순서로 호출해 자기 자신이 뽑히면 후보)
      const cands = RULES.filter((r) => mealGrammarCoaching({ ...base, params: { ...DEFAULT_MEAL_GRAMMAR_PARAMS, ORDER: [r, ...RULES.filter((x) => x !== r)] } }).active?.rule === r);
      if (cands.length > 0) {
        t.p2Days++;
        const w = (r: GrammarRuleId) => (u.goals.includes("근육증가") && r !== "G-VEG" ? 1.5 : 1);
        const fr = (r: GrammarRuleId) => { const s = g.stats[r]; return s.opps < 3 ? 0.5 : (s.opps - s.success) / s.opps; };
        const pick = [...cands].sort((a, b) => fr(b) * w(b) - fr(a) * w(a) || RULES.indexOf(a) - RULES.indexOf(b))[0];
        if (pick !== cands[0]) t.p2Diff++;
      }
    }
    // 끼니 단위 v1(g) vs G-PRO 불일치 — 체중 있는 사용자 · 주식 끼니 · 단백질 g·role 모두 판정 가능
    if (u.weight) {
      const gm = mealsFromRows(u.rows, new Date("2100-01-01T00:00:00+09:00"), 100000).map(judgeMeal);
      const gSum = new Map<string, number | null>();
      for (const r of u.rows) {
        const k = `${localDayKey(new Date(r.eaten_at))}|${r.meal_slot}`;
        const prev = gSum.has(k) ? gSum.get(k)! : 0;
        gSum.set(k, prev === null || r.protein_g === null ? null : prev + r.protein_g);
      }
      const target = perMealTargetG(u.weight, u.age, DEFAULT_GOAL_COACHING_PARAMS);
      for (const m of gm) {
        if (!["breakfast", "lunch", "dinner"].includes(m.slot) || m.staple !== true || m.protein === null) continue;
        const pg = gSum.get(`${m.day}|${m.slot}`);
        if (pg == null) continue;
        const v1Short = pg <= Math.round(target * (1 - DEFAULT_GOAL_COACHING_PARAMS.SHORT_NORMAL) * 10) / 10;
        const gShort = m.protein === false;
        if (v1Short && gShort) t.mealV1G.both++; else if (v1Short) t.mealV1G.v1only++; else if (gShort) t.mealV1G.gonly++; else t.mealV1G.neither++;
      }
    }
  }
  return t;
}

export function report(t: ReturnType<typeof simulate>): string {
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "—");
  const m = t.mealV1G, mm = m.both + m.v1only + m.gonly + m.neither;
  return [
    `# 코칭 사전 시뮬레이션 결과`,
    `| 지표 | 값 |`, `|---|---|`,
    `| 사용자 | ${t.users} |`, `| 사용자·기록일 | ${t.userDays} |`,
    `| P1 활성 카드 뜬 날 | ${t.daysActive} (${pct(t.daysActive, t.userDays)}) |`,
    `| └ G-PRO / G-VEG / G-AM | ${t.byRule["G-PRO"]} / ${t.byRule["G-VEG"]} / ${t.byRule["G-AM"]} |`,
    `| 유지 줄 뜬 날 · 졸업 경험 사용자 | ${t.daysMaint} · ${t.gradUsers.size} |`,
    `| v1 단백질 카드 뜬 날 | ${t.v1Days} (${pct(t.v1Days, t.userDays)}) |`,
    `| 안전 게이트 차단 날 | ${t.blockedDays} |`,
    `| 카드(v1 또는 P1)를 한 번이라도 본 사용자 | ${t.usersWithCard.size} (${pct(t.usersWithCard.size, t.users)}) |`,
    `| P2(병목)가 고정 순서와 다른 카드를 고른 날 | ${t.p2Diff}/${t.p2Days} (${pct(t.p2Diff, t.p2Days)}) |`,
    ``, `## 끼니 단위 v1(g 부족) vs G-PRO(단백질 반찬 없음) — 판정 가능 주식 끼니 ${mm}`,
    `| | G-PRO 없음 | G-PRO 있음 |`, `|---|---|---|`,
    `| v1 부족 | ${m.both} | ${m.v1only} |`, `| v1 충분 | ${m.gonly} | ${m.neither} |`,
    `- 불일치율 = ${pct(m.v1only + m.gonly, mm)} (v1만 부족 ${m.v1only} · G-PRO만 없음 ${m.gonly})`,
  ].join("\n");
}

const argv = process.argv.slice(2).filter((a) => a !== "--" && a !== "--legacy");
if (argv[0]) {
  const out = report(simulate(parseCsv(readFileSync(argv[0], "utf8"))));
  if (argv[1]) writeFileSync(argv[1], out + "\n", "utf8");
  console.log(out);
}
