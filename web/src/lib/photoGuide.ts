/**
 * 사진 식사 — 기준 도구 촬영 안내 + 검출 피드백 (IP/integration/meal_photo_reference_guide_v1.md)
 * 검출은 엔진(ref_detection_v2)이 하고, 앱은 analysis_job.result.reference 를 문구로만 바꾼다(원칙 5).
 */
export const PHOTO_GUIDE_TIPS: string[] = [
  '🥢 숟가락이나 젓가락을 음식 옆에 함께 찍으면 양을 더 정확히 맞출 수 있어요',
  '📷 위에서, 그릇이 모두 나오게, 밝은 곳에서 찍어 주세요',
]

/** name 에 목적격 조사까지 붙여 둔다(포크·카드 → «를»). */
const REF_LABEL: Record<string, { icon: string; name: string }> = {
  ref_spoon: { icon: '🥄', name: '숟가락을' },
  ref_chopsticks: { icon: '🥢', name: '젓가락을' },
  ref_fork: { icon: '🍴', name: '포크를' },
  ref_coin: { icon: '🪙', name: '500원 동전을' },
  ref_card: { icon: '💳', name: '카드를' },
  cup: { icon: '🥤', name: '컵을' },
  phone: { icon: '📱', name: '휴대폰을' },
}

/** 엔진 reference → 결과 화면 한 줄. 검출 없음·모르는 값은 null(표시 안 함). */
export function referenceNote(ref: unknown): string | null {
  if (!ref || typeof ref !== 'object') return null
  const r = ref as { detected?: unknown; type?: unknown; level?: unknown }
  if (r.detected !== true || typeof r.type !== 'string') return null
  const l = REF_LABEL[r.type]
  if (!l) return null
  return r.level === 'low'
    ? `${l.icon} ${l.name} 참고해 양을 대략 맞췄어요`
    : `${l.icon} ${l.name} 기준으로 양을 맞췄어요`
}
