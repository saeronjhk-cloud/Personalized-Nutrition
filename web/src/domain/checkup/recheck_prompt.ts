/**
 * 재검진 입력 안내 v1 (순수) — 마지막 검진 기록이 오래되면 재방문 홈에 «새 결과가 있으면 입력해 보세요» 한 줄.
 * 설계·평가 IP/integration/recheck_prompt_v1/00_설계·평가셋_v1.md (R01~R10)
 * - 검진을 «받으라»고 하지 않는다(재검 시기는 의료진 — 서박사 승인 관찰 안내 10-14). 앱은 입력만 권한다.
 */
export const RECHECK_PROMPT_DAYS = 365;
const DAY_MS = 86_400_000;

export interface RecheckPrompt { text: string; daysSince: number }

export const RECHECK_SAVE_MESSAGE = "검진 결과가 저장되었습니다. 다음 검진 결과를 입력하면 지난 결과와 비교해 드려요.";

/** latestRecordedDate = 가장 최근 검진일 'YYYY-MM-DD'(없으면 null) */
export function recheckPrompt(latestRecordedDate: string | null, now: Date, checkupEnabled: boolean): RecheckPrompt | null {
  if (!checkupEnabled || !latestRecordedDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(latestRecordedDate);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSince = Math.round((today.getTime() - d.getTime()) / DAY_MS);
  if (daysSince < RECHECK_PROMPT_DAYS) return null;
  return { text: `마지막 검진 기록이 ${d.getFullYear()}년 ${d.getMonth() + 1}월이에요. 새 검진 결과가 있으면 입력해 보세요.`, daysSince };
}
