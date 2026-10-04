/**
 * 홈 개편 v1 — 모드·시작 선택·오늘 끼니 판정 · 순수 · 결정론(원칙5) · IO import 0
 * 평가: IP/integration/home_redesign_v1_design.md §3 (H01~H09·H14)
 */
export type HomeMode = "visitor" | "returning";
export type StartChoice = "meal" | "survey" | "checkup" | "scan";

export interface HomeFlags { meal: boolean; checkup: boolean; meokseon: boolean; mealGrammar: boolean; goalCoaching: boolean }

/** returning = 로그인 + 식사·설문·검진 기록 중 하나 이상 */
export function homeMode(i: { isLoggedIn: boolean; hasAnyRecord: boolean }): HomeMode {
  return i.isLoggedIn && i.hasAnyRecord ? "returning" : "visitor";
}

export interface StartOption { id: StartChoice; to: string; title: string; desc: string }

const OPTIONS: Record<StartChoice, StartOption> = {
  meal: { id: "meal", to: "/meal", title: "오늘 먹은 음식 사진 한 장", desc: "가장 빠름 · 약 10초" },
  survey: { id: "survey", to: "/survey", title: "3분 건강 설문", desc: "증상·생활 습관으로 맞춤 영양 분석" },
  checkup: { id: "checkup", to: "/checkup", title: "건강검진 결과 입력", desc: "내 검진 수치부터 확인" },
  scan: { id: "scan", to: "/scan", title: "가공식품 성분부터 보기", desc: "바코드·제품명으로 10초 해석" },
};

/** 시작 선택: 주 선택지(사진→설문→검진, 켜진 것만) + 보조 링크(가공식품) */
export function startOptions(f: Pick<HomeFlags, "meal" | "checkup" | "meokseon">): { main: StartOption[]; extra: StartOption | null } {
  const main: StartOption[] = [];
  if (f.meal) main.push(OPTIONS.meal);
  main.push(OPTIONS.survey);
  if (f.checkup) main.push(OPTIONS.checkup);
  return { main, extra: f.meokseon ? OPTIONS.scan : null };
}

/** 오늘(로컬 날짜) 아침·점심·저녁 기록 여부. meal_slot null·snack 은 세지 않음 */
export function todaySlots(rows: readonly { eaten_at: string; meal_slot: string | null }[], now: Date = new Date()): [boolean, boolean, boolean] {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const out: [boolean, boolean, boolean] = [false, false, false];
  const idx: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 };
  for (const r of rows) {
    const t = new Date(r.eaten_at);
    if (Number.isNaN(t.getTime()) || t.getFullYear() !== y || t.getMonth() !== m || t.getDate() !== d) continue;
    const i = r.meal_slot != null ? idx[r.meal_slot] : undefined;
    if (i !== undefined) out[i] = true;
  }
  return out;
}

/**
 * 오늘의 한 가지: /meal 과 같은 순서로 켜진 카드를 모두 둔다(v1 목표 코칭 → 끼니 문법 P1).
 * 두 카드는 서로 중복을 막는다(v1 단백질 카드가 보이면 P1 이 G-PRO·G-AM 을 내지 않음, 설계 §5-4) →
 * 한쪽만 고르면 v1 이 보이는 날 홈에 아무 카드도 안 나오는 문제(10-04 수정). 각 카드는 판정이 없으면 스스로 숨는다.
 */
export function todayCards(f: Pick<HomeFlags, "meal" | "mealGrammar" | "goalCoaching">): ("goal" | "grammar")[] {
  if (!f.meal) return [];
  const out: ("goal" | "grammar")[] = [];
  if (f.goalCoaching) out.push("goal");
  if (f.mealGrammar) out.push("grammar");
  return out;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 5 ? "편안한 밤이에요" : h < 11 ? "좋은 아침이에요" : h < 17 ? "좋은 오후예요" : "좋은 저녁이에요";
}
