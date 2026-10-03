/**
 * eGFR 산출용 성별·나이 출처 결정 — 순수 · 결정론(원칙5) · IO import 0
 * 평가: IP/integration/egfr_ckd_epi_eval_v1.md «v2 추가» (E15~E25) · 의료 자문 아님
 * 규칙: 검진 프로필(profiles.sex M/F · birth_year — 검진 저장 시 필수) 우선 → 설문 실응답 → 미상.
 *       설문 구 행의 «성별 null → 'male' 채움»과 설문 초기값(male·30)은 근거로 쓰지 않는다(지어내지 않음).
 *       나이 = 검진일 연도 − 출생연도(생일 미상 → 최대 1살 많게 = eGFR 약간 낮게 = 보수 쪽).
 */
import type { Sex } from "./egfr";

export interface EgfrDemographicsInput {
  profileSex: string | null | undefined;
  profileBirthYear: number | null | undefined;
  recordedDate: string | null | undefined;
  surveySex: unknown;
  surveySexKnown: boolean;
  surveyAge: number | null | undefined;
  today?: Date;
}

export interface EgfrDemographics {
  sex: Sex | null;
  sexSource: "profile" | "survey" | null;
  age: number | null;
  ageSource: "profile" | "survey" | null;
}

function yearOf(dateStr: string | null | undefined, today: Date): number {
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(dateStr ?? "");
  return m ? Number(m[1]) : today.getFullYear();
}

export function egfrDemographics(i: EgfrDemographicsInput): EgfrDemographics {
  const today = i.today ?? new Date();
  let sex: Sex | null = null;
  let sexSource: EgfrDemographics["sexSource"] = null;
  if (i.profileSex === "M" || i.profileSex === "F") {
    sex = i.profileSex === "F" ? "female" : "male";
    sexSource = "profile";
  } else if (i.surveySexKnown && (i.surveySex === "male" || i.surveySex === "female")) {
    sex = i.surveySex;
    sexSource = "survey";
  }

  let age: number | null = null;
  let ageSource: EgfrDemographics["ageSource"] = null;
  const by = i.profileBirthYear;
  const refYear = yearOf(i.recordedDate, today);
  if (typeof by === "number" && Number.isInteger(by) && by >= 1900 && by <= refYear) {
    age = refYear - by;
    ageSource = "profile";
  } else if (typeof i.surveyAge === "number" && Number.isFinite(i.surveyAge) && i.surveyAge > 0) {
    age = i.surveyAge;
    ageSource = "survey";
  }
  return { sex, sexSource, age, ageSource };
}

/** 설문 행의 성별이 «실제 응답»인가 — answers jsonb 가 있으면 그 값, 없으면 gender 컬럼(구 행). null 채움은 false */
export function surveySexKnown(row: { answers?: unknown; gender?: string | null }): boolean {
  const a = row.answers;
  if (a && typeof a === "object") {
    const g = (a as Record<string, unknown>)["성별"];
    return g === "male" || g === "female";
  }
  return row.gender === "male" || row.gender === "female";
}
