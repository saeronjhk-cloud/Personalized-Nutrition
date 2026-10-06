/**
 * 검진 입력 화면 사용자 안내 (순수) — DB biomarker_rules.note 는 개발 메모라 화면에 쓰지 않는다.
 * inverted(= 낮으면 문제) 항목 배지는 INVERTED_BADGE. 평가: IP/integration/checkup_input_label_eval_v1.md
 */
export const INVERTED_BADGE = "(낮으면 주의)";

const HINT: Record<string, string> = {
  HDL: "높을수록 좋은 콜레스테롤이에요.",
  egfr: "결과지에 없으면 비워 두세요. 크레아티닌·성별·나이로 추정해요.",
  hemoglobin: "결과지의 ‘혈색소(Hb)’ 값을 적어 주세요.",
};

export function inputHint(key: string): string | null {
  return HINT[key] ?? null;
}
