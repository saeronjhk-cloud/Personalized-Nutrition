/**
 * 문구 검사기 v1 — 소스 코드에서 «화면에 보일 수 있는 한글 문구»를 뽑아 금지어를 찾는다.
 * 정본 평가셋: IP/integration/copy_guard_v1/00_문구검사기_평가셋_v1.md (X01~X15)
 *
 * - 순수 함수(파일 읽기 없음). 전체 스캔은 __tests__/copy_guard.test.ts 가 한다.
 * - 주석(// · /* *\/)은 문구가 아니므로 뺀다. 문자열('…' "…" `…`)과 JSX 글자(코드 영역의 한글)를 문구로 본다.
 * - 금지어 사전은 새로 만들지 않는다 — 검진 화면 정본 BANNED_WORDS(domain/checkup/compliance.ts)를 그대로 쓴다.
 */

export type CopyChunk = { line: number; text: string };

const HANGUL = /[가-힣]/;

/** 소스에서 한글이 든 문자열·JSX 글자 조각을 줄 번호와 함께 뽑는다(주석 제외). */
export function extractKoreanText(src: string): CopyChunk[] {
  const out: CopyChunk[] = [];
  let i = 0;
  let line = 1;
  let code = "";
  let codeLine = 1;
  const flushCode = () => {
    // 코드 영역의 한글 = JSX 글자. 줄 단위로 끊어 넣는다.
    const parts = code.split("\n");
    parts.forEach((p, k) => {
      if (HANGUL.test(p)) out.push({ line: codeLine + k, text: p.trim() });
    });
    code = "";
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      flushCode();
      while (i < src.length && src[i] !== "\n") i++;
      codeLine = line;
      continue;
    }
    if (c === "/" && n === "*") {
      flushCode();
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i += 2;
      codeLine = line;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      flushCode();
      const q = c;
      const start = line;
      let s = "";
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          s += src[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (src[i] === "\n") {
          line++;
          if (q !== "`") break; // 닫히지 않은 따옴표(JSX 글자 속 아포스트로피 등) — 줄 끝에서 멈춘다
        }
        s += src[i];
        i++;
      }
      i++;
      if (HANGUL.test(s)) out.push({ line: start, text: s });
      codeLine = line;
      continue;
    }
    if (c === "\n") line++;
    code += c;
    i++;
  }
  flushCode();
  return out;
}

export type CopyAllow = { file: string; contains: string; reason: string };
export type CopyHit = { file: string; line: number; word: string; text: string };

/** 조각들에서 금지어를 찾는다. allow(파일 + 문구 일부 + 근거)에 걸리면 뺀다. */
export function findBannedCopy(
  file: string,
  chunks: CopyChunk[],
  words: readonly string[],
  allow: readonly CopyAllow[] = [],
): CopyHit[] {
  const hits: CopyHit[] = [];
  for (const ch of chunks) {
    for (const w of words) {
      if (!ch.text.includes(w)) continue;
      const ok = allow.some((a) => a.file === file && ch.text.includes(a.contains) && a.contains.includes(w));
      if (!ok) hits.push({ file, line: ch.line, word: w, text: ch.text });
    }
  }
  return hits;
}
