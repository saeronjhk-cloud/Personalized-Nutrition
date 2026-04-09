import { queryPublishedPosts, pageToSummary } from './_notion.js'

/**
 * GET /api/blog
 * Notion 데이터베이스에서 발행된 블로그 글 목록을 반환합니다.
 * Vercel Edge cache로 60초 캐싱 (Notion API rate limit 보호).
 */
export default async function handler(req: any, res: any) {
  // CORS (동일 오리진이라 사실 불필요하지만 혹시 모를 경우)
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const pages = await queryPublishedPosts()
    const posts = pages.map(pageToSummary).filter(p => p.slug)

    // Vercel edge cache: 60초간 캐시, 오래된 결과는 300초까지 재사용
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ posts })
  } catch (err: any) {
    console.error('[api/blog] 에러:', err)
    res.status(500).json({ error: err.message || '블로그 목록을 불러올 수 없습니다.' })
  }
}
