/**
 * Notion API 공통 유틸리티
 * - 환경변수: NOTION_TOKEN (Notion integration secret)
 *             NOTION_BLOG_DB_ID (블로그 데이터베이스 ID)
 */

export const NOTION_API_VERSION = '2022-06-28'
export const NOTION_BASE = 'https://api.notion.com/v1'

export interface BlogPostSummary {
  slug: string
  title: string
  summary: string
  category: string
  date: string
  emoji: string
  thumb: string
  readMin: number
}

export interface BlogPostSection {
  heading: string
  body: string
}

export interface BlogPostDetail extends BlogPostSummary {
  sections: BlogPostSection[]
  sources: string[]
}

/** 공통 헤더 */
export function notionHeaders(): Record<string, string> {
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN 환경변수가 설정되지 않았습니다.')
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json',
  }
}

/** 속성 값에서 plain text 추출 */
export function getPlainText(prop: any): string {
  if (!prop) return ''
  if (prop.type === 'title') return prop.title.map((t: any) => t.plain_text).join('')
  if (prop.type === 'rich_text') return prop.rich_text.map((t: any) => t.plain_text).join('')
  if (prop.type === 'select') return prop.select?.name || ''
  if (prop.type === 'status') return prop.status?.name || ''
  if (prop.type === 'date') return prop.date?.start || ''
  if (prop.type === 'number') return String(prop.number ?? '')
  if (prop.type === 'files') {
    const first = prop.files?.[0]
    if (!first) return ''
    return first.type === 'external' ? first.external.url : first.file?.url || ''
  }
  return ''
}

/** 카테고리에 맞는 기본 썸네일 이미지 매핑 */
const DEFAULT_THUMBS: Record<string, string> = {
  '비타민': '/supp-bowls.jpg',
  '오메가-3': '/supp-overhead.jpg',
  '유산균': '/supp-bottles.jpg',
  '미네랄': '/supp-hero.jpg',
  '복용법': '/supp-natural.jpg',
  '면역': '/supp-wellness.jpg',
  '피부': '/supp-fruits.jpg',
  '수면': '/supp-capsule.jpg',
  '기타': '/supp-fitness.jpg',
}

export function getDefaultThumb(category: string): string {
  return DEFAULT_THUMBS[category] || '/supp-hero.jpg'
}

/** Notion page -> BlogPostSummary 변환 */
export function pageToSummary(page: any): BlogPostSummary {
  const props = page.properties
  const category = getPlainText(props['카테고리'])
  const thumbFromNotion = getPlainText(props['썸네일'])
  return {
    slug: getPlainText(props['Slug']),
    title: getPlainText(props['제목']),
    summary: getPlainText(props['요약']),
    category,
    date: getPlainText(props['발행일']),
    emoji: getPlainText(props['이모지']) || '📝',
    thumb: thumbFromNotion || getDefaultThumb(category),
    readMin: Number(props['읽기시간']?.number) || 5,
  }
}

/** 데이터베이스에서 발행된 글 조회 */
export async function queryPublishedPosts(): Promise<any[]> {
  const dbId = process.env.NOTION_BLOG_DB_ID
  if (!dbId) throw new Error('NOTION_BLOG_DB_ID 환경변수가 설정되지 않았습니다.')

  const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: '상태',
        status: { equals: '완료' },
      },
      sorts: [
        { property: '발행일', direction: 'descending' },
      ],
      page_size: 100,
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Notion query 실패: ${res.status} ${txt}`)
  }

  const data = await res.json()
  return data.results || []
}

/** 페이지 ID로 블록 콘텐츠 조회 */
export async function fetchPageBlocks(pageId: string): Promise<any[]> {
  const blocks: any[] = []
  let cursor: string | undefined = undefined

  do {
    const url: string = cursor
      ? `${NOTION_BASE}/blocks/${pageId}/children?start_cursor=${cursor}&page_size=100`
      : `${NOTION_BASE}/blocks/${pageId}/children?page_size=100`

    const res = await fetch(url, { headers: notionHeaders() })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Notion blocks 실패: ${res.status} ${txt}`)
    }
    const data = await res.json()
    blocks.push(...(data.results || []))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return blocks
}

/** 블록 배열을 섹션(heading + body)으로 변환 */
export function blocksToSections(blocks: any[]): BlogPostSection[] {
  const sections: BlogPostSection[] = []
  let current: BlogPostSection | null = null

  const extractText = (richText: any[]): string =>
    richText?.map((t: any) => t.plain_text).join('') || ''

  for (const block of blocks) {
    const type = block.type
    if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
      if (current) sections.push(current)
      current = {
        heading: extractText(block[type].rich_text),
        body: '',
      }
    } else if (type === 'paragraph') {
      const text = extractText(block.paragraph.rich_text)
      if (!text) continue
      if (!current) {
        current = { heading: '', body: text }
      } else {
        current.body += (current.body ? '\n\n' : '') + text
      }
    } else if (type === 'bulleted_list_item') {
      const text = extractText(block.bulleted_list_item.rich_text)
      if (!text) continue
      const line = `• ${text}`
      if (!current) current = { heading: '', body: line }
      else current.body += (current.body ? '\n' : '') + line
    } else if (type === 'numbered_list_item') {
      const text = extractText(block.numbered_list_item.rich_text)
      if (!text) continue
      if (!current) current = { heading: '', body: text }
      else current.body += (current.body ? '\n' : '') + text
    } else if (type === 'quote') {
      const text = extractText(block.quote.rich_text)
      if (!text) continue
      if (!current) current = { heading: '', body: text }
      else current.body += (current.body ? '\n\n' : '') + text
    }
  }

  if (current) sections.push(current)
  return sections
}

/** 참고자료 텍스트를 배열로 변환 */
export function parseSources(raw: string): string[] {
  if (!raw) return []
  return raw
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}
