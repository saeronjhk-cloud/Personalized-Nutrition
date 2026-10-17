/**
 * 지금 드시는 영양제 점검 v1 (순수 · 결정론) — 설문 «현재 복용 영양제» 조합에서 확인할 점을 최대 2줄로.
 * 확정 문구·결정 기록: IP/integration/supplement_reduce_v1/10_회신·제이결정_확정문구_평가셋_v1.md (S01~S16)
 * - 끊으라고 하지 않는다(확인·점검·상담 권유까지). 함량은 모른다 — 체크 항목만 본다.
 */
import type { SurveyAnswers } from "../../types";
import { SUPPLEMENTS } from "../../engine/data";

export type ReduceId = "IRON" | "GAP" | "MULTI" | "MANY";
export interface ReduceLine { id: ReduceId; text: string }

/** 표시 순서(위험도 순 — 검토 A) · 최대 줄 수 */
export const REDUCE_ORDER: readonly ReduceId[] = ["IRON", "GAP", "MULTI", "MANY"];
export const REDUCE_MAX_LINES = 2;
export const MANY_THRESHOLD = 5;

/** 종합비타민과 겹치는 단일 성분(설문 선택지 순서) */
const MULTI_OVERLAP: readonly { id: string; label: string }[] = [
  { id: "vitamin_d", label: "비타민D" },
  { id: "vitamin_c", label: "비타민C" },
  { id: "calcium", label: "칼슘" },
  { id: "iron", label: "철분" },
  { id: "magnesium", label: "마그네슘" },
];

export const REDUCE_TEXT = {
  IRON: "철분은 몸에 쌓이기 쉬워 필요할 때만 드시는 것이 좋아요. 계속 드실지 의사·약사와 한번 확인해 보세요.",
  GAP: "철분과 칼슘은 서로 다른 시간에 드시는 편이 좋아요. 별도 안내가 없다면 약 2시간 간격을 두세요.",
  MULTI: "종합비타민에도 {items}{josa} 포함되어 있을 수 있어요. 각 제품의 1일 섭취량 기준 함량을 합산해 라벨에서 확인해 보세요.",
  MANY: "복용 중인 영양제가 5종 이상이에요. 제품 라벨을 한데 놓고 중복 성분과 1일 섭취량을 점검해 보세요.",
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

function ironTarget(a: SurveyAnswers): boolean {
  if ((a.기저질환 ?? []).includes("임산부_수유부")) return false;
  const hint = ironSymptomIds();
  if ((a.증상 ?? []).some((s) => hint.includes(s))) return false;
  if (a.성별 === "male") return true;
  if (a.성별 === "female") {
    if (a.월경상태 === "폐경") return true;
    if (!a.월경상태) return (a.나이 ?? 0) >= 50;
  }
  return false;
}

export function reduceCheck(a: SurveyAnswers | null | undefined): ReduceLine[] {
  const cur = new Set(a?.현재복용영양제 ?? []);
  if (!a || cur.size === 0) return [];
  const out: Partial<Record<ReduceId, string>> = {};
  if (cur.has("iron") && ironTarget(a)) out.IRON = REDUCE_TEXT.IRON;
  if (cur.has("iron") && cur.has("calcium")) out.GAP = REDUCE_TEXT.GAP;
  if (cur.has("multivitamin")) {
    const items = MULTI_OVERLAP.filter((x) => cur.has(x.id)).map((x) => x.label);
    if (items.length) {
      const joined = items.join("·");
      out.MULTI = REDUCE_TEXT.MULTI.replace("{items}", joined).replace("{josa}", subjectJosa(joined));
    }
  }
  if (cur.size >= MANY_THRESHOLD) out.MANY = REDUCE_TEXT.MANY;
  return REDUCE_ORDER.filter((id) => out[id]).slice(0, REDUCE_MAX_LINES).map((id) => ({ id, text: out[id]! }));
}
