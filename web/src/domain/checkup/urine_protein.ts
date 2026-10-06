/**
 * 요단백 (순수) — 결과지 기호 ↔ 저장 코드(순서형) · 화면 표시
 * 코드: 음성 0 · 약양성(±) 0.5 · 양성 +1~+4 → 1~4 (tools/gen_biomarker_map_v1_3.py · SQL 159 와 일치)
 * 평가: IP/integration/checkup_urine_protein_eval_v1.md P01~P08·T01
 */
export const URINE_PROTEIN_KEY = "urine_protein";

export const URINE_PROTEIN_OPTIONS: readonly { code: number; label: string }[] = [
  { code: 0, label: "음성(-)" },
  { code: 0.5, label: "약양성(±)" },
  { code: 1, label: "양성(+1)" },
  { code: 2, label: "양성(+2)" },
  { code: 3, label: "양성(+3)" },
  { code: 4, label: "양성(+4)" },
];

/** 숫자 대신 단계(기호)로 다루는 항목 — 변화율·추이 그래프 대상 아님 */
export const ORDINAL_KEYS: ReadonlySet<string> = new Set([URINE_PROTEIN_KEY]);
export const isOrdinalKey = (key: string) => ORDINAL_KEYS.has(key);

/** 결과지 표기 → 코드. 모르면 null(추측 금지) */
export function parseUrineProtein(raw: string): number | null {
  const s = raw.replace(/\s+/g, "").toLowerCase();
  if (!s) return null;
  if (/약양성|±|\+-|\+\/-|trace/.test(s)) return 0.5;
  const plusNum = s.match(/\+([1-4])|([1-4])\+/);
  if (plusNum) return Number(plusNum[1] ?? plusNum[2]);
  const plusRun = s.match(/\+{1,4}/);
  if (plusRun && !/음성|neg/.test(s)) return plusRun[0].length;
  if (/음성|negative|neg|^\(?-\)?$/.test(s)) return 0;
  if (/양성|positive|pos/.test(s)) return 1;
  return null;
}

export function formatBiomarkerValue(key: string, value: number): string {
  if (key === URINE_PROTEIN_KEY) {
    const o = URINE_PROTEIN_OPTIONS.find((x) => x.code === value);
    if (o) return o.label;
  }
  return String(value);
}
