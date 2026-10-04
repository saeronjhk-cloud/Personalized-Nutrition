/**
 * ★ 세션75b — 서술격 조사 «이라/라» (운영 실물 10-04: «혈당 관리 목표이라» 오문).
 *   마지막 글자가 한글 음절이면 받침 유무로 고르고, 아니면 «(이)라» — 추측하지 않는다.
 */
export function withIra(word: string): string {
  const w = (word ?? '').replace(/\s+$/, '')
  if (!w) return ''
  const c = w.charCodeAt(w.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return `${w}(이)라`
  return (c - 0xac00) % 28 === 0 ? `${w}라` : `${w}이라`
}
