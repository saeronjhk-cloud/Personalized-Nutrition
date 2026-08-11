/**
 * ★★★★ 세션61 `U60-7` — 「사진 제보 결과에 알레르기 카드가 «배선돼 있는가»」 구조 가드.
 *
 * 왜 이런 «소스 검사»를 하나 — 정공법이 지금은 비싸다
 *   `Scan.tsx` 는 카메라(`BarcodeDetector`)·Supabase·스캔 이력·이벤트 트래킹을 한꺼번에 끌고 온다.
 *   그걸 전부 목킹해서 렌더 테스트를 세우는 것은 이 변경 하나를 지키자고 하기엔 과하고,
 *   목킹이 많아질수록 «테스트가 통과하는데 화면은 깨지는» 상태가 되기 쉽다.
 *
 * 그래서 무엇을 지키는가 — 딱 하나다:
 *   **「목록이 비면 아무것도 안 그리는 한 줄」로 되돌아가지 않는다.**
 *
 *   종전 코드(세션61 이전):
 *     {reportInfo.allergens.length > 0 && ` · 알레르기 ${reportInfo.allergens.join(', ')}`}
 *   목록이 비면 그 줄이 아예 안 붙었다 = **침묵**.
 *   `domain/meokseon/allergens.ts:15` 가 그걸 경고한다 —
 *   「아무 표시도 안 하면 사용자는 «안전하다»고 읽는다」.
 *
 *   실측(세션61 · 실물 67건 · `IP/U61-4_침묵률_실측_2026-08-11_세션61.md`):
 *     목록이 비는 라벨 24건(35.8%) 중
 *       · 실제로 «직접 함유»가 있는 것    7건 (29.2%)
 *       · 혼입까지 세면 알려줄 게 있는 것 15건 (62.5%)
 *     같은 24건을 «바코드» 경로로 보면 24건 «전부»에 무언가를 말해 준다.
 *
 * ⚠ 이 테스트는 «약하다». 소스 문자열을 볼 뿐 렌더 결과를 보지 않는다.
 *   ⇒ 「초록이니까 화면이 맞다」로 읽지 말 것. 이건 **되돌림 방지 장치**이지 동작 증명이 아니다.
 *   ⇒ `Scan.tsx` 에 제대로 된 렌더 테스트가 생기면 이 파일은 지워도 된다.
 *     (그때까지는 지우지 말 것 — 이걸 지우면 배선을 지켜보는 것이 아무것도 없다.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCAN = resolve(HERE, '../Scan.tsx')
const src = readFileSync(SCAN, 'utf8')

/** 주석을 걷어낸 «실제 코드». 주석 안의 예시 문자열에 속지 않기 위해 필요하다. */
const code = src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')   // JSX 주석 블록 {/* ... */}
  .replace(/\/\*[\s\S]*?\*\//g, '')             // 일반 블록 주석
  .replace(/^\s*\/\/.*$/gm, '')                 // 줄 주석

describe('Scan — 사진 제보 결과 알레르기 배선 (세션61 U60-7)', () => {
  it('AllergenCard 를 import 한다', () => {
    expect(code).toMatch(/import\s+AllergenCard\s+from/)
  })

  it('★ 사진 제보 결과(reportInfo)에 AllergenCard 를 붙인다', () => {
    expect(code).toMatch(/<AllergenCard\s+result=\{reportInfo\}/)
  })

  it('★★ 바코드 결과(result)의 카드도 그대로 남아 있다 — 한쪽을 고치며 다른 쪽을 지우지 않는다', () => {
    expect(code).toMatch(/<AllergenCard\s+result=\{result\}/)
  })

  it('⚠ 「목록이 비면 안 그리는」 한 줄이 되살아나지 않았다', () => {
    // 종전 형태: reportInfo.allergens.length > 0 && ...
    expect(code).not.toMatch(/reportInfo\.allergens\.length\s*>\s*0/)
  })
})
