/**
 * 검진 그림 PDF 글자 인식(OCR) v1 — 글자 상자(Vision 단어 + 위치) → 기존 파서가 읽을 «한 줄 = 항목 값» 텍스트
 * 정본 설계·평가셋: IP/integration/checkup_ocr_v1/00_설계·평가셋_v1.md (R01~R08 · O01~O14)
 *
 * 엔진 우선(원칙5): 값 해석은 하지 않는다. 표의 «어느 칸이 이번 결과인가»만 위치로 고르고,
 * 라벨·단위·범위 판단은 기존 parseCheckupText 가 한다. 사용자가 값을 확인한 뒤에만 저장된다.
 *
 * 표 판단(병원 결과지 서식: 검사항목 | 참고치 | 날짜1 | 날짜2 …):
 * - 날짜 머리글 줄을 찾으면, 가장 최근 날짜(YYYY-MM-DD)의 열 범위 = 이웃 머리글과의 중간점
 * - 그 아래 줄마다 «라벨 칸(참고치 머리글 왼쪽)» + «이번 결과 칸» 만 뽑는다. 참고치·지난 결과 칸은 버린다.
 * - 결과 칸이 값 모양(숫자·음성/양성·±·+n·TR)이 아닌 줄(설명 문단 등)은 버린다 → 설명 속 숫자 오독 0
 * 날짜 머리글이 없는 쪽: 문장이 아닌 짧은 줄만 그대로 넘긴다(공단 결과통보서처럼 «항목 값 단위» 한 줄 서식).
 */

export type OcrWord = { t: string; x0: number; x1: number; y0: number; y1: number };

type Row = { cy: number; h: number; w: OcrWord[] };

const FULL_DATE = /^(19|20)\d{2}[-.](0[1-9]|1[0-2])[-.](0[1-9]|[12]\d|3[01])\.?$/;
const PART_DATE = /^(19|20)\d{2}[-.]?$/;
const REF_HEAD = /^참고(치|범위)?$|^참$|^기준(치|범위)?$/;
const VALUE_CELL = /^(?:[<>≤≥]?\s*\d+(?:[.,]\d+)?|음성|양성|약양성|±|\+-|\+[1-4]|[1-4]\+|\+{1,4}|TR|trace|negative|positive)/i;
const UNIT_WORD = /(?:^|[^A-Za-z])(?:mg|g|ng|pg|μ|µ|u|iu|meq|mmol|ml|mm|fl|sec|cm|kg)?\/(?:dl|l|ml|ul|μl|hpf|min|hr)|^%$|^(?:fl|pg|sec|mm\/hr)$/i;
const UNIT_PIECE = /^[A-Za-zμµ°/%·.0-9]+$/;
const SENTENCE = /(니다|하다|어요|에요|세요|됩니다|입니다)[.,]?$|[.。]$/;
const SECTION_URINE = /소변|요\s*검사|뇨\s*검사/;

/** 단어 상자 → 같은 높이끼리 묶은 줄(왼→오) */
export function groupRows(words: OcrWord[]): Row[] {
  const ws = [...words].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const rows: Row[] = [];
  for (const w of ws) {
    const cy = (w.y0 + w.y1) / 2;
    const h = w.y1 - w.y0;
    const last = rows[rows.length - 1];
    if (last && Math.abs(cy - last.cy) < Math.max(h, last.h) * 0.5) last.w.push(w);
    else rows.push({ cy, h, w: [w] });
  }
  for (const r of rows) r.w.sort((a, b) => a.x0 - b.x0);
  return rows;
}

/** 줄 글자 — 가까운 상자는 붙이고 떨어진 상자는 띄운다(«공복시혈당» 같은 낱말이 끊기지 않게) */
export function joinWords(ws: OcrWord[]): string {
  let s = "";
  let px: number | null = null;
  for (const w of ws) {
    const gap = px === null ? 0 : w.x0 - px;
    const hgt = Math.max(1, w.y1 - w.y0);
    if (px !== null && gap > hgt * 0.35) s += " ";
    s += w.t;
    px = w.x1;
  }
  return s;
}

export type Cols = { left: number; right: number; labelRight: number; date: string };

function headerCols(r: Row): Cols | null {
  const dates = r.w.filter((w) => FULL_DATE.test(w.t) || PART_DATE.test(w.t));
  const full = dates.filter((w) => FULL_DATE.test(w.t));
  if (full.length === 0) return null;
  const norm = (t: string) => t.replace(/\./g, "-").replace(/-$/, "");
  const cur = full.reduce((a, b) => (norm(b.t) > norm(a.t) ? b : a));
  const xs = [...dates].sort((a, b) => a.x0 - b.x0);
  const i = xs.indexOf(cur);
  const ref = r.w.find((w) => REF_HEAD.test(w.t.replace(/\s/g, "")));
  const firstDate = xs[0];
  const labelRight = ref ? ref.x0 : firstDate.x0;
  const prevEdge = i > 0 ? xs[i - 1].x1 : ref ? ref.x1 : cur.x0 - (cur.x1 - cur.x0);
  const left = (prevEdge + cur.x0) / 2;
  const right = i + 1 < xs.length ? (cur.x1 + xs[i + 1].x0) / 2 : cur.x1 + (cur.x1 - cur.x0) * 0.5;
  return { left, right, labelRight, date: norm(cur.t) };
}

/** 한 쪽(페이지)의 단어 상자 → 파서용 줄들. 표가 다음 쪽으로 이어지면(머리글 없이 시작) 앞 쪽의 열 위치를 이어 쓴다(같은 배율 렌더). */
export function ocrPageToLines(words: OcrWord[], carry: { cols: Cols | null; section: string } = { cols: null, section: "" }): string[] {
  const out: string[] = [];
  let cols: Cols | null = carry.cols;
  let section = carry.section;
  for (const r of groupRows(words)) {
    const h = headerCols(r);
    if (h) {
      cols = h;
      out.push(`검진일 ${h.date}`);
      continue;
    }
    const text = joinWords(r.w);
    if (!cols) {
      if (text.length <= 40 && !SENTENCE.test(text)) out.push(text);
      continue;
    }
    const c: Cols = cols;
    const labelWs = r.w.filter((w) => w.x1 <= c.labelRight + 2);
    const valWs = r.w.filter((w) => {
      const cx = (w.x0 + w.x1) / 2;
      return cx >= c.left && cx <= c.right;
    });
    const val = joinWords(valWs).trim();
    if (labelWs.length === 0 || !val || !VALUE_CELL.test(val)) {
      // 표 밖 줄: 짧은 제목이면 구역 이름으로 기억(소변 검사 → 단백 = 요단백)
      if (text.length <= 20 && !SENTENCE.test(text)) section = text;
      continue;
    }
    // 단위 = 라벨 칸 오른쪽 끝에 붙은 영문·기호 상자들(mg/ dL · IU/ L · %) — 괄호 속 약어(GOT·Hb)는 라벨에 남긴다
    let k = labelWs.length;
    while (k > 1 && UNIT_PIECE.test(labelWs[k - 1].t)) k--;
    const unitWs = labelWs.slice(k);
    const units = UNIT_WORD.test(unitWs.map((w) => w.t).join("")) ? unitWs.map((w) => w.t).join("") : "";
    let label = joinWords(units ? labelWs.slice(0, k) : labelWs).trim();
    if (SECTION_URINE.test(section) && /^단백(뇨)?$/.test(label.replace(/\s/g, ""))) label = "요단백";
    out.push(units ? `${label} ${val} ${units}` : `${label} ${val}`);
  }
  carry.cols = cols;
  carry.section = section;
  return out;
}

/** 여러 쪽 → parseCheckupText 입력. 검진일 줄은 맨 앞 한 번만. */
export function ocrPagesToCheckupText(pages: OcrWord[][]): string {
  const carry: { cols: Cols | null; section: string } = { cols: null, section: "" };
  const lines = pages.flatMap((p) => ocrPageToLines(p, carry));
  const dates = lines.filter((l) => l.startsWith("검진일 "));
  const latest = dates.map((l) => l.slice(4)).sort().pop();
  const body = lines.filter((l) => !l.startsWith("검진일 "));
  return [latest ? `검진일 ${latest}` : "", ...body].filter(Boolean).join("\n");
}
