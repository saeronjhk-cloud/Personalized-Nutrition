import {
  queryPublishedPosts,
  pageToSummary,
  fetchPageBlocks,
  blocksToSections,
  parseSources,
  getPlainText,
} from '../_notion.js'

/**
 * GET /api/blog/[slug]
 * Slug로 특정 블로그 글의 전체 콘텐츠를 반환합니다.
 */
export default async function handler(req: any, res: any) {
  // CORS — 앱(Capacitor)에서 외부 요청 시 preflight 허용 필요
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const slug = req.query?.slug as string | undefined
  if (!slug) {
    res.status(400).json({ error: 'slug가 필요합니다.' })
    return
  }

  try {
    // 1. 발행된 글 목록에서 slug로 매칭되는 페이지 찾기
    const pages = await queryPublishedPosts()
    const matched = pages.find(
      (p: any) => getPlainText(p.properties['Slug']) === slug
    )

    if (!matched) {
      res.status(404).json({ error: '해당 글을 찾을 수 없습니다.' })
      return
    }

    const summary = pageToSummary(matched)

    // 2. 페이지 블록 콘텐츠 조회
    const blocks = await fetchPageBlocks(matched.id)
    const sections = blocksToSections(blocks)
    const sources = parseSources(getPlainText(matched.properties['참고자료']))

    const post = {
      ...summary,
      sections,
      sources,
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ post })
  } catch (err: any) {
    console.error('[api/blog/[slug]] 에러:', err)
    res.status(500).json({ error: err.message || '블로그 글을 불러올 수 없습니다.' })
  }
}
