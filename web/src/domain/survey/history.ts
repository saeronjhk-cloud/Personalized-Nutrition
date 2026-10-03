/**
 * 설문 기록 — 서버 우선 선택 · 순수 (IO import 0)
 * 평가: IP/integration/survey_history_server_eval_v1.md (H01~H12)
 * 배경: 홈·건강 변화 리포트·결과 비교·먹선 개인화가 localStorage 만 읽어 다른 기기·주소에서 «기록 없음»(10-03 진단).
 */
import type { RecommendationResult, SurveyAnswers, SurveyRecord } from "../../types";

export interface ServerSurveyRow {
  id: string;
  created_at: string;
  answers: unknown;
}

export const SERVER_HISTORY_CAP = 20;
const RESURVEY_DAYS = 30;
const DAY_MS = 1000 * 60 * 60 * 24;

/** 서버 행 → SurveyRecord(최신순). 결과는 compute(=현재 엔진)로 재계산. 비정상·예외 행은 건너뜀 */
export function serverRowsToHistory(
  rows: readonly ServerSurveyRow[],
  compute: (a: SurveyAnswers) => RecommendationResult,
  cap: number = SERVER_HISTORY_CAP,
): SurveyRecord[] {
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const out: SurveyRecord[] = [];
  for (const r of sorted) {
    if (out.length >= cap) break;
    if (!r.answers || typeof r.answers !== "object") continue;
    const answers = r.answers as SurveyAnswers;
    try {
      out.push({ id: r.id, date: r.created_at, answers, result: compute(answers) });
    } catch {
      /* 이 행만 건너뜀 */
    }
  }
  return out;
}

/** 로그인+서버 성공 → 서버만 / 로그인+서버 실패 → local / 비로그인 → local */
export function chooseHistory(i: { loggedIn: boolean; serverOk: boolean; server: SurveyRecord[]; local: SurveyRecord[] }): SurveyRecord[] {
  if (i.loggedIn && i.serverOk) return i.server;
  return i.local;
}

export interface ResurveyState {
  latest: SurveyRecord | null;
  daysSince: number;
  prompt: boolean;
  canCompare: boolean;
}

/** history 는 최신순 전제 */
export function resurveyState(history: readonly SurveyRecord[], now: Date): ResurveyState {
  const latest = history[0] ?? null;
  const daysSince = latest ? Math.floor((now.getTime() - new Date(latest.date).getTime()) / DAY_MS) : -1;
  return { latest, daysSince, prompt: latest != null && daysSince >= RESURVEY_DAYS, canCompare: history.length >= 2 };
}
