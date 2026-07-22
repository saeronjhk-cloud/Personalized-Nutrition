// =============================================================================
// checkupImport — 건강검진 결과지(PDF) 가져오기 엔진 (v1, 2026-07-22 세션34)
//
// 원칙: 엔진 온리. AI 추론 없음. (원칙5 — 엔진에서 우선 해결, AI 는 추후 폴백)
// 흐름: PDF → 텍스트 추출(pdfjs-dist) → 라벨·값 파싱(정규식) →
//       biomarker_rules(display_name_ko) 매칭 → BiomarkerForm 프리필.
// 텍스트가 없는 스캔본 PDF 는 v1 에서 지원하지 않는다(안내 후 수기 입력).
//
// 출처 서식: 국민건강보험공단 일반건강검진 결과통보서 (The건강보험/정부24 PDF).
// 평가 셋: src/lib/__tests__/checkupImport.test.ts (Eval-First)
// =============================================================================

import type { BiomarkerRule } from "./checkup_api";

export interface ParsedItem {
  /** 결과지에 표기된 원본 라벨 (예: "공복혈당") */
  label: string;
  value: number;
  /** 파싱 근거가 된 원문 조각 (디버그·검증용) */
  raw: string;
}

export interface ParsedCheckup {
  /** 검진일 (YYYY-MM-DD). 못 찾으면 null — 저장 전 사용자가 지정 */
  date: string | null;
  items: ParsedItem[];
}

export interface MatchResult {
  /** biomarker_key → 입력 문자열 값 (BiomarkerForm values 형식) */
  matched: Record<string, string>;
  /** 파싱은 됐지만 룰에 매칭되지 않은 라벨 (사용자 안내용) */
  unmatchedLabels: string[];
}

// ── 라벨 정규화: 공백·괄호·구두점 제거, 소문자, 전각→반각 ──
export function normalizeLabel(s: string): string {
  return s
    .replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .toLowerCase()
    .replace(/[\s()\[\]{}·\-–—_:：./\\,]/g, "");
}

// ── 개념별 별칭 (NHIS 결과통보서 표기 변형 흡수) ──
// key: 개념 id (biomarker_key 와 일치할 것으로 기대되는 이름을 우선 사용)
// aliases: 결과지에 나타나는 라벨들 (normalizeLabel 적용 전 원형)
const CONCEPT_ALIASES: Record<string, string[]> = {
  height: ["신장", "키"],
  weight: ["체중", "몸무게"],
  waist: ["허리둘레"],
  bmi: ["체질량지수", "BMI"],
  blood_pressure: ["혈압", "수축기/이완기"],
  blood_pressure_systolic: ["수축기혈압", "최고혈압"],
  blood_pressure_diastolic: ["이완기혈압", "최저혈압"],
  fasting_glucose: ["공복혈당", "식전혈당", "공복시혈당", "혈당"],
  hba1c: ["당화혈색소", "HbA1c"],
  total_cholesterol: ["총콜레스테롤", "총콜레스테롤(TC)"],
  hdl_cholesterol: ["HDL콜레스테롤", "HDL-콜레스테롤", "고밀도콜레스테롤", "고밀도지단백"],
  ldl_cholesterol: ["LDL콜레스테롤", "LDL-콜레스테롤", "저밀도콜레스테롤", "저밀도지단백"],
  triglyceride: ["중성지방", "트리글리세라이드", "트리글리세리드"],
  hemoglobin: ["혈색소", "헤모글로빈"],
  ast: ["AST", "SGOT", "AST(SGOT)"],
  alt: ["ALT", "SGPT", "ALT(SGPT)"],
  gamma_gtp: ["감마지티피", "감마GTP", "γ-GTP", "r-GTP", "감마글루타밀전이효소"],
  creatinine: ["혈청크레아티닌", "크레아티닌"],
  egfr: ["신사구체여과율", "eGFR", "사구체여과율"],
  ferritin: ["페리틴", "혈청페리틴"],
};

// 정규화된 alias → 개념 id 역인덱스 (긴 alias 우선 매칭을 위해 길이 내림차순)
const ALIAS_INDEX: { alias: string; concept: string }[] = Object.entries(
  CONCEPT_ALIASES,
)
  .flatMap(([concept, aliases]) =>
    aliases.map((a) => ({ alias: normalizeLabel(a), concept })),
  )
  .sort((a, b) => b.alias.length - a.alias.length);

// ── 오탐 방지 ──
// 부정 문맥: 해당 개념 alias 가 있어도 이 단어가 같은 줄에 있으면 무시.
// 예: "신장(키)" vs "신사구체여과율·만성신장질환" 의 신장.
const NEGATIVE_CONTEXT: Record<string, RegExp> = {
  height: /여과율|사구체|질환|기능|이식/,
  fasting_glucose: /식후|요당/,
};

// 생리학적 타당 범위 — 벗어나면 잘못 집힌 숫자로 보고 버린다.
const PLAUSIBLE_RANGE: Record<string, [number, number]> = {
  height: [100, 230],
  weight: [25, 250],
  waist: [40, 200],
  bmi: [10, 60],
  blood_pressure_systolic: [60, 260],
  blood_pressure_diastolic: [30, 160],
  fasting_glucose: [40, 500],
  hba1c: [3, 20],
  total_cholesterol: [70, 500],
  hdl_cholesterol: [10, 150],
  ldl_cholesterol: [20, 400],
  triglyceride: [20, 2000],
  hemoglobin: [4, 25],
  ast: [5, 2000],
  alt: [3, 2000],
  gamma_gtp: [3, 2000],
  creatinine: [0.2, 15],
  egfr: [5, 200],
  ferritin: [1, 2000],
};

function isPlausible(concept: string, value: number): boolean {
  const range = PLAUSIBLE_RANGE[concept];
  if (!range) return true;
  return value >= range[0] && value <= range[1];
}

// ── 검진일 추출 ──
const DATE_LABELS = /(검진일자?|검진년월일|판정일자?|검사일자?)/;

export function parseCheckupDate(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const datePattern =
    /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/;

  // 1순위: 검진일 라벨이 있는 줄
  for (const line of lines) {
    if (DATE_LABELS.test(line)) {
      const m = line.match(datePattern);
      if (m) return toISO(m[1], m[2], m[3]);
    }
  }
  // 2순위: 문서 어디든 첫 날짜 (결과통보서 상단 검진일이 보통 첫 날짜)
  const m = text.match(datePattern);
  if (m) return toISO(m[1], m[2], m[3]);
  return null;
}

function toISO(y: string, mo: string, d: string): string | null {
  const year = parseInt(y, 10);
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  if (year < 1990 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── 본문 파싱: 라벨 뒤 첫 숫자를 값으로 ──
// pdf.js 텍스트는 표가 "공복혈당 95 mg/dL 정상A" 처럼 평탄화되어 나온다.
const NUMBER_RE = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/;

export function parseCheckupText(text: string): ParsedCheckup {
  const date = parseCheckupDate(text);
  const items: ParsedItem[] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const norm = normalizeLabel(line);
    if (!norm) continue;

    for (const { alias, concept } of ALIAS_INDEX) {
      if (seen.has(concept)) continue;
      const idx = norm.indexOf(alias);
      if (idx === -1) continue;
      if (NEGATIVE_CONTEXT[concept]?.test(line)) continue;

      // 라벨 위치 이후의 원문에서 값 추출 (정규화 전 원문 기준으로 다시 탐색)
      const labelPos = findOriginalPos(line, alias);
      const tail = labelPos === -1 ? line : line.slice(labelPos);

      // 혈압: "120/80" 형태 → 수축기·이완기 분리
      if (concept === "blood_pressure") {
        const bp = tail.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
        if (bp) {
          pushItem(items, seen, "blood_pressure_systolic", line, bp[1]);
          pushItem(items, seen, "blood_pressure_diastolic", line, bp[2]);
          seen.add(concept);
        }
        continue;
      }

      const m = tail.match(NUMBER_RE);
      if (m) {
        pushItem(items, seen, concept, line, m[1]);
      }
    }
  }

  return { date, items };
}

function pushItem(
  items: ParsedItem[],
  seen: Set<string>,
  concept: string,
  raw: string,
  numStr: string,
) {
  const value = parseFloat(numStr.replace(/,/g, ""));
  if (Number.isNaN(value)) return;
  if (!isPlausible(concept, value)) return;
  if (seen.has(concept)) return;
  seen.add(concept);
  items.push({ label: concept, value, raw: raw.trim() });
}

// 정규화된 alias 가 원문에서 시작하는 대략적 위치를 찾는다.
// (정규화로 제거되는 문자를 건너뛰며 스캔)
function findOriginalPos(line: string, normAlias: string): number {
  const lower = line.toLowerCase();
  for (let start = 0; start < lower.length; start++) {
    let li = start;
    let ai = 0;
    while (li < lower.length && ai < normAlias.length) {
      const ch = normalizeLabel(lower[li]);
      if (ch === "") {
        li++;
        continue;
      }
      if (ch !== normAlias[ai]) break;
      li++;
      ai++;
    }
    if (ai === normAlias.length) return li; // 라벨 끝 위치 반환 → 값은 그 뒤에서 탐색
  }
  return -1;
}

// ── 룰 매칭: 개념 id ↔ biomarker_rules ──
// 1) 개념 id == biomarker_key 정확 일치
// 2) display_name_ko 정규화 문자열이 개념 별칭과 포함 관계
export function matchToRules(
  parsed: ParsedCheckup,
  rules: BiomarkerRule[],
): MatchResult {
  const matched: Record<string, string> = {};
  const unmatchedLabels: string[] = [];

  for (const item of parsed.items) {
    const rule = findRule(item.label, rules);
    if (rule) {
      matched[rule.biomarker_key] = String(item.value);
    } else {
      unmatchedLabels.push(item.label);
    }
  }

  return { matched, unmatchedLabels };
}

function findRule(concept: string, rules: BiomarkerRule[]): BiomarkerRule | null {
  // 1) 키 정확 일치
  const exact = rules.find((r) => r.biomarker_key === concept);
  if (exact) return exact;

  // 2) display_name_ko ↔ 개념 별칭 포함 관계
  const aliases = (CONCEPT_ALIASES[concept] ?? []).map(normalizeLabel);
  for (const rule of rules) {
    const dn = normalizeLabel(rule.display_name_ko);
    if (dn.length < 2) continue;
    for (const alias of aliases) {
      if (alias.length < 2) continue;
      if (dn.includes(alias) || alias.includes(dn)) return rule;
    }
  }
  return null;
}

// ── PDF 텍스트 추출 (pdfjs-dist, 브라우저 전용 — 테스트 대상 아님) ──
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // y 좌표(행) 기준으로 묶어 줄 단위 텍스트 재구성 — 표 평탄화 품질 개선
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const tx = it.transform as number[];
      const y = Math.round(tx[5]);
      const x = tx[4];
      const bucket =
        rows.get(y) ??
        rows.get(y - 1) ??
        rows.get(y + 1) ??
        (() => {
          const b: { x: number; str: string }[] = [];
          rows.set(y, b);
          return b;
        })();
      bucket.push({ x, str: it.str });
    }
    const lines = Array.from(rows.entries())
      .sort((a, b) => b[0] - a[0]) // PDF 좌표는 아래가 0 → 위에서 아래로
      .map(([, cells]) =>
        cells
          .sort((a, b) => a.x - b.x)
          .map((c) => c.str)
          .join(" "),
      );
    pages.push(lines.join("\n"));
  }

  return pages.join("\n");
}
