export const ALLOWED_TONE_TEMPLATES: Record<string, string> = {
  유지: "현재 수치는 안정적입니다. 건강한 식습관을 유지하세요.",
  관리권장:
    "관리가 필요한 수치가 있습니다. 식약처 인정 기능성 영양제 보충이 도움이 될 수 있습니다.",
  전문가상담권장: "주의가 필요한 수치가 있습니다. 의료 전문가 상담을 권장합니다.",
};

export const BANNED_WORDS = [
  "예방",
  "치료",
  "치유",
  "고친다",
  "낫는다",
  "100%",
  "확실히",
  "효과적",
  "효능",
] as const;

export const SAFE_TONE_FALLBACK =
  "검진 수치를 참고용으로 안내합니다. 건강 관련 결정은 전문가와 상담하세요.";

export function checkCompliance(text: string): boolean {
  return !BANNED_WORDS.some((word) => text.includes(word));
}

export function resolveToneBody(tone: string | null): string | null {
  if (!tone || !ALLOWED_TONE_TEMPLATES[tone]) return null;
  const template = ALLOWED_TONE_TEMPLATES[tone];
  return checkCompliance(template) ? template : SAFE_TONE_FALLBACK;
}
