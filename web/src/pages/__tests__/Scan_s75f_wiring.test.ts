/**
 * ★ 세션75f — 제보 화면 «관리자 확인 결과를 메일로 받기» (옵트인 · 제이 결정 10-04) 배선.
 *   ⚠ Scan.tsx 는 렌더 테스트가 어려워 «소스 배선» 검사를 쓴다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOTIFY_RESULT_LABEL, NOTIFY_RESULT_NOTE, REPORT_SAVED_NEW } from '../../domain/meokseon/photoReport'
import { PREVIEW_DISCLAIMER } from '../../domain/meokseon/reportNutrition'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(HERE, '../Scan.tsx'), 'utf8')

describe('Scan — 세션75f 결과 메일 옵트인', () => {
  it('체크박스는 기본 «꺼짐» · 보내기 버튼 앞 · 문구는 domain 정본', () => {
    expect(src).toMatch(/useState\(false\)[^\n]*notifyResult|const \[notifyResult, setNotifyResult\] = useState\(false\)/)
    const i = src.indexOf('data-testid="notify-result"'); const j = src.indexOf('onClick={confirmReport}')
    expect(i).toBeGreaterThan(0); expect(j).toBeGreaterThan(i)
    expect(src.slice(i, j)).toContain('NOTIFY_RESULT_LABEL')
  })
  it('확정 요청에 신청 여부를 싣는다', () => {
    expect(src).toMatch(/confirmPhotoReport\(\{[\s\S]{0,200}notifyResult/)
  })
  it('문구: 신청 안내 · 무조건 «알려드릴게요» 약속은 하지 않는다(신청자만 메일)', () => {
    expect(NOTIFY_RESULT_LABEL).toContain('메일')
    expect(NOTIFY_RESULT_NOTE).toContain('한 번')
    expect(REPORT_SAVED_NEW).not.toMatch(/알려\s*드릴|알려드릴/)
    expect(PREVIEW_DISCLAIMER).not.toMatch(/알려\s*드릴|알려드릴/)
    expect(src).not.toContain('(등록되면 알려드릴게요.)')
  })
})
