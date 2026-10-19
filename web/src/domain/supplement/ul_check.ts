/**
 * 영양제 함량 합계 점검 v0 (순수 · 결정론) — 사용자가 넣은 라벨 «1일 섭취량 기준 함량»을 성분별로 더해
 * 2025 KDRI 상한섭취량(UL) 이상일 때만 한 줄. 식사 몫은 더하지 않는다(실제 총섭취량을 과소평가할 수 있음).
 * 확정 문구·결정: IP/웹앱트랙_서박사_회신원문_용량안내U·합계점검Q_20261019.md (제이 B 통합안 10-19)
 * 평가셋: IP/evals/eval_supp_ul_v0.json (복사본 __tests__/fixtures/) · 기준 수치는 criteria/kdri.ts UL_V0 만(H134)
 */
import { UL_V0, type UlEntry } from "../criteria/kdri";
import type { SurveyAnswers } from "../../types";
import { reduceCandidates, REDUCE_MAX_LINES } from "./reduce_check";

export type UlNutrientId = "vitamin_d" | "calcium" | "iron" | "zinc" | "vitamin_b6" | "vitamin_c" | "magnesium" | "folic_acid";
export type DoseUnit = "mg" | "μg" | "IU" | "μg DFE";
export interface DoseEntry { n: UlNutrientId; v: unknown; u: DoseUnit }
export interface UlLine { id: "UL"; n: UlNutrientId; sum: number; ul: number; text: string }

/** 화면 이름 + 목적격 조사(을/를) — 읽는 소리 기준(비타민D=디, B6=식스, C=씨 → «를») */
export const UL_LABEL: Record<UlNutrientId, { name: string; obj: "을" | "를" }> = {
  vitamin_d: { name: "비타민D", obj: "를" },
  calcium: { name: "칼슘", obj: "을" },
  iron: { name: "철", obj: "을" },
  zinc: { name: "아연", obj: "을" },
  vitamin_b6: { name: "비타민B6", obj: "를" },
  vitamin_c: { name: "비타민C", obj: "를" },
  magnesium: { name: "마그네슘", obj: "을" },
  folic_acid: { name: "합성 엽산", obj: "을" },
};

export const UL_TEXT =
  "입력하신 영양제의 {name}{obj} 합하면 하루 {sum}{unit}입니다. 영양제만으로도 2025 기준 상한({ul}{unit})에 도달했거나 넘으니, 총섭취량과 제품 조합을 확인해 주세요.";
/** 입력 화면 안내(Q2) — 경고 없음 ≠ 안전 */
export const UL_NOTICE = "입력한 영양제만 계산해 실제 총섭취량보다 적게 나올 수 있어요. 점검 문구가 없어도 안전하다는 뜻은 아니에요.";
export const UL_MIN_AGE = 19;

/** 단위 환산 → UL 단위(비타민D μg · 합성 엽산 μg · 나머지 mg). 잘못된 값(숫자 아님·0 이하·무한)은 null */
export function toUlUnit(n: UlNutrientId, v: unknown, u: DoseUnit): number | null {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(x) || x <= 0) return null;
  if (n === "vitamin_d") return u === "IU" ? x / 40 : u === "μg" ? x : null;
  if (n === "folic_acid") return u === "μg DFE" ? x / 1.7 : u === "μg" ? x : null;
  return u === "mg" ? x : null;
}

/** 표시용 숫자 — 소수 1자리까지, 천 단위 쉼표 */
export function fmt(x: number): string {
  const r = Math.round(x * 10) / 10;
  return r.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

export function sumDoses(doses: readonly DoseEntry[]): Partial<Record<UlNutrientId, number>> {
  const s: Partial<Record<UlNutrientId, number>> = {};
  for (const d of doses) {
    const c = toUlUnit(d.n, d.v, d.u);
    if (c === null) continue;
    s[d.n] = (s[d.n] ?? 0) + c;
  }
  return s;
}

/** 19세 미만·나이 모름은 판정하지 않음(Q4). 임신·수유부는 같은 나이 여성 값(UL_V0 정의 그대로) */
export function ulCheck(sex: string | null | undefined, age: number | null | undefined, doses: readonly DoseEntry[]): UlLine[] {
  if (typeof age !== "number" || !Number.isFinite(age) || age < UL_MIN_AGE) return [];
  const s = sumDoses(doses);
  const out: UlLine[] = [];
  for (const e of UL_V0 as readonly UlEntry[]) {
    const id = e.id as UlNutrientId;
    const sum = s[id];
    if (sum === undefined) continue;
    const ul = e.ul(sex, age);
    if (sum + 1e-9 < ul) continue;
    const lab = UL_LABEL[id];
    const text = UL_TEXT.replace("{name}", lab.name).replace("{obj}", lab.obj)
      .replace("{sum}", fmt(sum)).replace("{ul}", fmt(ul)).split("{unit}").join(e.unit);
    out.push({ id: "UL", n: id, sum, ul, text });
  }
  return out;
}

/** 점검 상자 전체 줄 — UL 줄이 맨 앞(Q3), 이어서 기존 점검(reduce) 후보, 합쳐 최대 2줄 */
export function supplementCheckLines(
  answers: SurveyAnswers | null | undefined,
  doses: readonly DoseEntry[],
  ulEnabled: boolean,
): { key: string; text: string }[] {
  const ul = ulEnabled && answers ? ulCheck(answers.성별, answers.나이, doses).map((l) => ({ key: `UL_${l.n}`, text: l.text })) : [];
  const rest = reduceCandidates(answers).map((l) => ({ key: l.id, text: l.text }));
  return [...ul, ...rest].slice(0, REDUCE_MAX_LINES);
}
