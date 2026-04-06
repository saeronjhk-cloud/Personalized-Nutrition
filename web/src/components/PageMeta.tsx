import { useEffect } from 'react'

interface Props {
  title?: string
  description?: string
}

const BASE_TITLE = '서박사의 영양공식'
const BASE_DESC = '36가지 신체 신호를 분석하여 식약처 인정 건강기능식품 기반 맞춤 영양제를 추천합니다. 3분 무료 설문으로 나에게 필요한 영양제를 찾아보세요.'

export default function PageMeta({ title, description }: Props) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} | 맞춤 영양제 추천`

    const desc = description || BASE_DESC
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', desc)

    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute('content', document.title)

    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc) ogDesc.setAttribute('content', desc)

    const twTitle = document.querySelector('meta[name="twitter:title"]')
    if (twTitle) twTitle.setAttribute('content', document.title)

    const twDesc = document.querySelector('meta[name="twitter:description"]')
    if (twDesc) twDesc.setAttribute('content', desc)
  }, [title, description])

  return null
}
