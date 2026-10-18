/**
 * 지금 드시는 영양제 점검 v1.2 (순수 · 결정론) — 설문 «현재 복용 영양제» 조합에서 확인할 점을 최대 2줄로.
 * 확정 문구·결정 기록: IP/웹앱트랙_서박사_최종확인_영양제점검_v1.2_20261017.md (서박사 P1~P4 승인 10-17)
 *   평가셋: IP/evals/eval_supplement_check_v1.2.json (복사본 __tests__/fixtures/)
 * - 끊으라고 하지 않는다(확인·점검·상담 권유까지). 함량은 모른다 — 체크 항목만 본다.
 * - v1 → v1.2: 문구 4종 교체 · MEDS(약 복용) 신설 · MULTI 대상 3종 · IRON 나이 대리 기준 삭제 + 철분 권고 복용 제외
 */
import type { SurveyAnswers } from "../../types";
import { SUPPLEMENTS } from "../../engine/data";

export type ReduceId = "IRON" | "MEDS" | "GAP" | "MULTI" | "MANY";
export interface ReduceLine { id: ReduceId; text: string }

/** 표시 순서(구체적 안전 → 일반 안전 → 흡수 → 중복 → 가짓수) · 최대 줄 수 */
export const REDUCE_ORDER: readonly ReduceId[] = ["IRON", "MEDS", "GAP", "MULTI", "MANY"];
export const REDUCE_MAX_LINES = 2;
/** 화면 노출용 운영 기준(의학 기준 아님) */
export const MANY_THRESHOLD = 5;

/** 종합비타민과 겹치는 단일 성분 — 상한·축적 우려 3종만(비타민C·마그네슘 제외), 이 순서로 잇는다 */
const MULTI_OVERLAP: readonly { id: string; label: string }[] = [
  { id: "vitamin_d", label: "비타민D" },
  { id: "calcium", label: "칼슘" },
  { id: "iron", label: "철분" },
];

export const REDUCE_TEXT = {
  IRON: "철분은 필요한 경우가 정해져 있어요. 드시는 이유를 의사·약사와 한번 확인해 보세요.",
  MEDS: "드시는 약이 있으면 현재 복용 중인 영양제와 함께 드셔도 되는지 의사·약사에게 확인해 보세요.",
  GAP: "철분과 칼슘은 함께 드시면 철분 흡수에 영향을 줄 수 있어요. 두 제품은 서로 다른 시간대에 드세요.",
  MULTI: "종합비타민에도 {items}{josa} 들어 있을 수 있어요. 제품 라벨에서 해당 성분의 1일 섭취량을 더해 확인해 보세요.",
  MANY: "지금 드시는 영양제가 {n}가지예요. 겹치는 성분이 없는지 한 번에 점검해 보세요.",
} as const;

/** 철분과 이어진 증상 — data.ts 철분 symptom_indicators 단일 출처 */
export function ironSymptomIds(): string[] {
  const iron = SUPPLEMENTS.find((s) => s.id === "iron");
  return [...((iron?.symptom_indicators as string[] | undefined) ?? [])];
}

/** 이/가 — 마지막 글자 받침. 영문 끝(비타민D·C)은 읽는 소리(디·씨)에 받침 없음 → «가» */
export function subjectJosa(word: string): "이" | "가" {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? "가" : "이";
  if (/[LMNRlmnr]/.test(ch)) return "이"; // 엘·엠·엔·알
  return "가";
}

/** 약 복용 — 유무 문항 «있음» 또는 (문항 미응답인 예전 기록) 약 이름 칸이 비어 있지 않음 */
export function onMedication(a: SurveyAnswers): boolean {
  if (a.복용약있음 === "있음") return true;
  if (a.복용약있음 === "없음") return false;
  return !!a.복용약물?.trim();
}

/**
 * 철분 점검 대상 — 남성 또는 폐경 여성만. 나이로 폐경을 대신하지 않는다(월경 미응답·정상·불규칙 여성 = 미적용).
 * 제외: 임산부·수유부 · 철분 연결 증상 · 진단·의사·약사 권고로 복용(철분권고 «예»).
 * 채식·과다월경·위장관 질환·잦은 헌혈 제외는 설문에 문항이 생기면 여기에 추가(v1.2 승인 조건 «설문에 있을 때»).
 */
function ironTarget(a: SurveyAnswers): boolean {
  if ((a.기저질환 ?? []).includes("임산부_수유부")) return false;
  if (a.철분권고 === "예") return false;
  const hint = ironSymptomIds();
  if ((a.증상 ?? []).some((s) => hint.includes(s))) return false;
  if (a.성별 === "male") return true;
  if (a.성별 === "female") return a.월경상태 === "폐경";
  return false;
}

/** 표시 전 후보 전부(순서대로) — 평가셋 candidates 검증용 */
export function reduceCandidates(a: SurveyAnswers | null | undefined): ReduceLine[] {
  const cur = new Set(a?.현재복용영양제 ?? []);
  if (!a || cur.size === 0) return [];
  const out: Partial<Record<ReduceId, string>> = {};
  if (cur.has("iron") && ironTarget(a)) out.IRON = REDUCE_TEXT.IRON;
  if (onMedication(a)) out.MEDS = REDUCE_TEXT.MEDS;
  if (cur.has("iron") && cur.has("calcium")) out.GAP = REDUCE_TEXT.GAP;
  if (cur.has("multivitamin")) {
    const items = MULTI_OVERLAP.filter((x) => cur.has(x.id)).map((x) => x.label);
    if (items.length) {
      const joined = items.join("·");
      out.MULTI = REDUCE_TEXT.MULTI.replace("{items}", joined).replace("{josa}", subjectJosa(joined));
    }
  }
  if (cur.size >= MANY_THRESHOLD) out.MANY = REDUCE_TEXT.MANY.replace("{n}", String(cur.size));
  return REDUCE_ORDER.filter((id) => out[id]).map((id) => ({ id, text: out[id]! }));
}

export function reduceCheck(a: SurveyAnswers | null | undefined): ReduceLine[] {
  return reduceCandidates(a).slice(0, REDUCE_MAX_LINES);
}
