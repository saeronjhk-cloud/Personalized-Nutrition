/**
 * 문구 검사기 v1 — 평가셋 IP/integration/copy_guard_v1/00_문구검사기_평가셋_v1.md (X01~X15)
 * 금지어 사전은 검진 정본 BANNED_WORDS 하나만 쓴다(X15 — 목록 복사 금지).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { extractKoreanText, findBannedCopy, type CopyAllow } from "../copy_scan";
import { BANNED_WORDS } from "../../checkup/compliance";
import { PERSONAS } from "../../../engine/data";

const W = BANNED_WORDS;
const scan = (src: string, allow: CopyAllow[] = [], file = "x.tsx") =>
  findBannedCopy(file, extractKoreanText(src), W, allow);

describe("X01~X11 추출·판정", () => {
  it("X01 줄 주석은 문구 아님", () => expect(scan("// 예방\nconst a = 1;")).toHaveLength(0));
  it("X02 작은따옴표", () => expect(scan("const a = '빈혈 예방';").map((h) => h.word)).toEqual(["예방"]));
  it("X03 큰따옴표", () => expect(scan('const a = "치료 효과";')).toHaveLength(1));
  it("X04 템플릿", () => expect(scan("const a = `${b} 효능`;")).toHaveLength(1));
  it("X05 JSX 글자", () => expect(scan("return <p>질병 예방</p>;")).toHaveLength(1));
  it("X06 한글 없는 문자열(style 100%)", () => expect(scan("style={{ width: '100%' }}")).toHaveLength(0));
  it("X07 줄 번호", () => expect(scan("a\nb\nconst c = '예방';")[0].line).toBe(3));
  it("X08 예외 파일이 다르면 검출", () => {
    const allow = [{ file: "other.ts", contains: "빈혈 예방", reason: "t" }];
    expect(scan("'빈혈 예방'", allow)).toHaveLength(1);
  });
  it("X09 예외 조각에 금지어가 없으면 무효", () => {
    const allow = [{ file: "x.tsx", contains: "사이여야", reason: "t" }];
    expect(scan("'0~100% 사이여야 해요'", allow)).toHaveLength(1);
  });
  it("X10 블록 주석 제외 · 뒤 줄 번호", () => {
    const h = scan("/* 치료\n 예방 */\nconst a = '효능';");
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ line: 3, word: "효능" });
  });
  it("X11 이스케이프 따옴표", () => expect(scan("const a = '그건 \\'예방\\'';")).toHaveLength(1));
});

/** 예외 v1 — 근거는 평가셋 §4. 새 예외는 평가셋 §4 에 먼저 적고 여기에 옮긴다. */
const SKIP_FILES = ["domain/checkup/compliance.ts"]; // 사전 자체
const ALLOW: CopyAllow[] = [
  { file: "domain/checkup/consent_v2.ts", contains: "진단·치료·처방이 아니며", reason: "부정 고지" },
  { file: "domain/unified/recommend.ts", contains: "진단·치료를 대체하지 않습니", reason: "부정 고지" },
  { file: "pages/Privacy.tsx", contains: "진단·치료 또는 의학적 판단을 대체하지", reason: "부정 고지" },
  { file: "pages/Terms.tsx", contains: "진단, 치료, 처방을 대체하지", reason: "부정 고지" },
  { file: "engine/data.ts", contains: "호르몬 치료 중 의사 상담", reason: "주의(caution) — 상담 권고" },
  { file: "engine/data.ts", contains: "호르몬 치료제", reason: "약물 상호작용 항목명" },
  { file: "engine/data.ts", contains: "스태미나 저하에 효과적", reason: "화면 미노출(영양제 description) — 노출 시 교체" },
  { file: "engine/data.ts", contains: "빈혈 예방", reason: "화면 미노출(영양제 description) — 노출 시 교체" },
  { file: "engine/data.ts", contains: "황반변성 예방", reason: "화면 미노출(영양제 description) — 노출 시 교체" },
  { file: "engine/data.ts", contains: "유전변이 시 더 효과적", reason: "화면 미노출(dosage_guide.form) — 노출 시 교체" },
  { file: "lib/mealLeftover.ts", contains: "0~100%", reason: "먹은 양 수치 범위" },
  { file: "lib/mealSavedEdit.ts", contains: "100%로 돌아감", reason: "먹은 양 수치 범위" },
];

const SRC = resolve(__dirname, "../../..");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) return n === "__tests__" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) && !n.endsWith(".d.ts") ? [p] : [];
  });

describe("X12~X15 저장소 전체", () => {
  const files = walk(SRC).map((p) => ({ rel: relative(SRC, p).split("\\").join("/"), src: readFileSync(p, "utf-8") }));
  const targets = files.filter((f) => !SKIP_FILES.includes(f.rel));

  it("X12 예외 외 금지어 0건", () => {
    expect(targets.length).toBeGreaterThan(100);
    const hits = targets.flatMap((f) => findBannedCopy(f.rel, extractKoreanText(f.src), W, ALLOW));
    expect(hits.map((h) => `${h.file}:${h.line} «${h.word}» ${h.text.slice(0, 60)}`)).toEqual([]);
  });

  it("X13 죽은 예외 0 — 모든 예외가 실제로 1건 이상 걸러낸다", () => {
    const dead = ALLOW.filter((a) => {
      const f = targets.find((t) => t.rel === a.file);
      if (!f) return true;
      return findBannedCopy(a.file, extractKoreanText(f.src), W, []).every((h) => !h.text.includes(a.contains));
    });
    expect(dead.map((a) => `${a.file} «${a.contains}»`)).toEqual([]);
  });

  it("X14 기본 유형(general_wellness) 💡 문구 교체 · 금지어 0", () => {
    const p = PERSONAS.find((x) => x.id === "general_wellness")!;
    expect(p.tagline).toBe("지금 당장 큰 문제는 없어요. 기본을 꾸준히 챙기는 게 가장 좋은 관리예요");
    for (const x of PERSONAS) for (const w of W) expect(`${x.tagline ?? ""}|${x.description ?? ""}`, x.id).not.toContain(w);
  });

  it("X15 사전 = BANNED_WORDS 하나(9개) · 이 테스트는 목록을 복사하지 않는다", () => {
    expect(W.length).toBe(9);
    const self = readFileSync(__filename, "utf-8");
    expect(self).toContain('import { BANNED_WORDS } from "../../checkup/compliance"');
  });
});
