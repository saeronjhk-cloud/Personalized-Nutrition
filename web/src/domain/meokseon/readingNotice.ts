/**
 * ★ 세션75d — 제품 화면 «전체 판독 고지» (제이 결정 2026-10-04: 「전체 고지 1개 + 알레르기 1줄」).
 *
 * 왜: 알레르기 카드에만 «아직 검증 중인 기능» 경고가 붙어, 똑같이 자동 판독인 첨가물·영양·원재료는
 *   믿어도 되는 것처럼 읽혔다(제이 실물 제보 10-04). 고지를 화면 맨 위 «한 곳»으로 모은다.
 *   알레르기는 틀리면 생명과 직결되므로 카드 안에 «포장 직접 확인» 한 줄은 남긴다(ALLERGEN_PACKAGE_LINE).
 *
 * ⚠ 지키지 못할 약속을 하지 않는다 — 사용자에게 «알림»을 보내는 기능은 아직 없다.
 *   그래서 「관리자 확인이 끝나면 확인된 정보로 바뀌어요」까지만 말한다(승인 = contributionApply 가 제품에 반영).
 * ⚠ 공공 자료 제품엔 «관리자 확인» 약속을 하지 않는다 — 검토 큐에 오르는 것은 사용자 제보뿐이다.
 */
export type ReadingNoticeKind = 'crowd' | 'public'
export interface ReadingNotice { kind: ReadingNoticeKind; text: string }

export const READING_NOTICE_CROWD =
  '이 제품 정보는 사용자가 보낸 라벨 사진을 자동으로 판독해 만든 거예요. 판독이 불완전해 실제 표시와 다를 수 있어요. 관리자 확인이 끝나면 확인된 정보로 바뀌어요.'
export const READING_NOTICE_PUBLIC =
  '이 정보는 공공 자료와 제품 표시사항을 자동으로 정리한 거예요. 실제 포장 표시와 다를 수 있어요. 중요한 내용은 포장을 직접 확인해 주세요.'
export const ALLERGEN_PACKAGE_LINE = '알레르기가 있다면 반드시 포장의 알레르기 표기를 직접 확인해 주세요.'

export function readingNotice(product: { data_source?: string | null } | null | undefined): ReadingNotice {
  const ds = (product?.data_source ?? '').trim()
  return ds === 'ocr_crowdsource'
    ? { kind: 'crowd', text: READING_NOTICE_CROWD }
    : { kind: 'public', text: READING_NOTICE_PUBLIC }
}
