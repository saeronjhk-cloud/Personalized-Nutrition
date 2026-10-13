/**
 * 검진 단위 환산 (순수 · 결정론 · IO 0) — 원칙5: 엔진이 처리, AI 없음.
 * 평가: IP/integration/checkup_unit_convert_eval_v1.md (U01~U18)
 *
 * 쓰는 곳
 *  - PDF 가져오기: 값 뒤에 «다른 단위»가 **글자로 명시된 경우에만** 자동 환산(convertByUnitText)
 *  - 직접 입력: 자동 환산 안 함 — 범위 밖일 때 환산 안내만(manualUnitHint)
 * 환산계수 = 국제 표준(혈당 18.016 · 콜레스테롤 38.67 · 중성지방 88.57 · 크레아티닌 88.4 · 혈색소 g/L÷10 · HbA1c IFCC→NGSP)
 */

type Group = "glucose" | "chol" | "tg" | "creat" | "hb" | "a1c";

interface UnitRule {
  /** 기준 단위(판정표 단위) */
  base: string;
  /** 다른 단위 표시명 */
  alt: string;
  /** 값 바로 뒤 텍스트가 이 단위로 시작하는지 */
  re: RegExp;
  conv: (v: number) => number;
  digits: number;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

const RULES: Record<Group, UnitRule> = {
  glucose: { base: "mg/dL", alt: "mmol/L", re: /^\s*mmol\s*\/\s*l(?![a-z])/i, conv: (v) => v * 18.016, digits: 0 },
  chol: { base: "mg/dL", alt: "mmol/L", re: /^\s*mmol\s*\/\s*l(?![a-z])/i, conv: (v) => v * 38.67, digits: 0 },
  tg: { base: "mg/dL", alt: "mmol/L", re: /^\s*mmol\s*\/\s*l(?![a-z])/i, conv: (v) => v * 88.57, digits: 0 },
  creat: { base: "mg/dL", alt: "μmol/L", re: /^\s*[μµu]mol\s*\/\s*l(?![a-z])/i, conv: (v) => v / 88.4, digits: 2 },
  hb: { base: "g/dL", alt: "g/L", re: /^\s*g\s*\/\s*l(?![a-z])/i, conv: (v) => v / 10, digits: 1 },
  a1c: { base: "%", alt: "mmol/mol", re: /^\s*mmol\s*\/\s*mol(?![a-z])/i, conv: (v) => 0.0915 * v + 2.15, digits: 1 },
};

/** PDF 개념 id(checkupImport)와 biomarker_key 둘 다 받는다 */
const GROUP_BY_KEY: Record<string, Group> = {
  fasting_glucose: "glucose",
  total_cholesterol: "chol",
  hdl_cholesterol: "chol",
  ldl_cholesterol: "chol",
  HDL: "chol",
  LDL: "chol",
  triglyceride: "tg",
  creatinine: "creat",
  hemoglobin: "hb",
  hba1c: "a1c",
  HbA1c: "a1c",
};

export interface UnitConversion {
  value: number;
  baseUnit: string;
  from: { value: number; unit: string };
}

/**
 * 값 바로 뒤 텍스트(after)에 «다른 단위»가 명시돼 있으면 기준 단위로 환산.
 * 기준 단위·단위 없음·모르는 항목 → null(그대로 사용).
 */
export function convertByUnitText(key: string, value: number, after: string | null | undefined): UnitConversion | null {
  const g = GROUP_BY_KEY[key];
  if (!g || !after || !Number.isFinite(value)) return null;
  const r = RULES[g];
  if (!r.re.test(after)) return null;
  return { value: round(r.conv(value), r.digits), baseUnit: r.base, from: { value, unit: r.alt } };
}

/** 불러오기 안내 한 줄 — 환산한 항목이 없으면 null */
export function convertedNotice(items: readonly { name: string; conversion: UnitConversion }[]): string | null {
  if (items.length === 0) return null;
  const parts = items.map(
    ({ name, conversion: c }) => `${name} ${c.from.value} ${c.from.unit} → ${c.value} ${c.baseUnit}`,
  );
  return `단위를 바꿔 넣었어요: ${parts.join(", ")}. 결과지와 맞는지 확인해 주세요.`;
}

/** 직접 입력이 범위 밖일 때 «다른 단위로 적은 것 같으면» 환산 안내(자동 변경 안 함) */
const MANUAL_TRIGGER: Partial<Record<Group, (v: number) => boolean>> = {
  chol: (v) => v < 20,
  tg: (v) => v < 10,
  creat: (v) => v > 20,
  hb: (v) => v > 25,
  a1c: (v) => v > 20,
};

export function manualUnitHint(key: string, value: number): string | null {
  const g = GROUP_BY_KEY[key];
  const trig = g ? MANUAL_TRIGGER[g] : undefined;
  if (!g || !trig || !Number.isFinite(value) || !trig(value)) return null;
  const r = RULES[g];
  const v = round(r.conv(value), r.digits);
  return `${r.alt} 로 적으셨다면 ${r.base} 로 약 ${v} 이에요. 결과지 단위를 확인해 주세요.`;
}
