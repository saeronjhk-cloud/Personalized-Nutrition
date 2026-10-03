/**
 * 코칭 카드 → 서박사 캐릭터 포즈 (순수). 판정은 코칭 엔진 결과만 사용.
 * 평가: IP/integration/coach_card_pose_eval_v1.md (P01~P10 · W1)
 * 포즈 파일: web/public/coach/coach_<pose>.webp (components/CoachAvatar.tsx COACH_POSES)
 */
import type { GrammarRuleId } from "./meal_grammar_params";

export type CoachingPose = "d4_protein" | "d5_veggie" | "c2_advice" | "a1_thumbs" | "c1_concern";

const RULE_POSE: Record<GrammarRuleId, CoachingPose> = { "G-PRO": "d4_protein", "G-VEG": "d5_veggie", "G-AM": "c2_advice" };

export function grammarPose(res: { active: { rule: GrammarRuleId } | null; maintenance: unknown | null }): CoachingPose | null {
  if (res.active) return RULE_POSE[res.active.rule];
  if (res.maintenance) return "a1_thumbs";
  return null;
}

export function v1Pose(card: { level: "normal" | "strong" }): CoachingPose {
  return card.level === "strong" ? "c1_concern" : "d4_protein";
}
