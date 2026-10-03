/**
 * 서박사 코칭 캐릭터 (web/public/coach/*.webp · 512 투명) — 식사 기록 화면용
 * 원본·톤 원칙: IP/character/서박사_캐릭터풀_v1.md · 사용표 web/public/coach/README.md
 * 장식 이미지라 alt="" + aria-hidden (문구는 옆 텍스트가 전달).
 */
export const COACH_POSES = [
  'a1_thumbs', 'a2_clap', 'a3_cheer', 'a4_fist', 'b1_default', 'b2_wave', 'b3_ok', 'b4_think',
  'c1_concern', 'c2_advice', 'c3_gentle_stop', 'd1_clipboard', 'd2_magnifier', 'd3_water',
  'd4_protein', 'd5_veggie', 'e1_welcome_back', 'e2_sorry',
] as const
export type CoachPose = typeof COACH_POSES[number]

export function coachSrc(pose: CoachPose): string {
  return `/coach/coach_${pose}.webp`
}

export default function CoachAvatar({ pose, size = 72, style }: { pose: CoachPose; size?: number; style?: React.CSSProperties }) {
  return (
    <img src={coachSrc(pose)} alt="" aria-hidden="true" width={size} height={size} loading="lazy" decoding="async"
      data-coach={pose} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, ...style }} />
  )
}
