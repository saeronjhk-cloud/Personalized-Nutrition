/**
 * 「내가 보낸 제보」 화면 — **구조 가드**(세션64c, 2026-08-24).
 *
 * 왜 «소스 검사»인가 — `Scan_allergen_wiring.test.ts` 와 같은 이유다.
 *   이 페이지는 라우터·먹선 API·Supabase 세션을 끌고 온다. 그걸 다 목킹해 렌더 테스트를
 *   세우는 것은 이 변경 하나를 지키자고 하기엔 과하고, 목킹이 많아질수록
 *   «테스트는 통과하는데 화면은 깨지는» 상태가 되기 쉽다.
 *
 * 그래서 무엇을 지키는가 — 셋이다.
 *   ① **「없다」·「못 불러왔다」·「로그인이 필요하다」가 «서로 다른» 화면이다.**
 *      섞이면 사용자는 자기 제보가 사라졌다고 읽는다. 2026-08-06 「거짓 확인」과 방향만
 *      반대인 같은 유형이다.
 *   ② **문구를 화면에서 다시 적지 않는다.** 정본은 `domain/meokseon/*` 한 곳이다.
 *   ③ **없는 상태를 지어내지 않는다.** 상태 문구는 순수함수가 만든다.
 *
 * ⚠ 이 테스트는 «약하다». 소스 문자열을 볼 뿐 렌더 결과를 보지 않는다.
 *   되돌림 방지 장치이지 동작 증명이 아니다.
 * ⚠ 2026-08-24 기준 서버에 `GET /api/contributions/mine` 은 **아직 없다**(구현 중).
 *   실제 왕복은 확인하지 못했다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(HERE, '../MyReports.tsx'), 'utf8')
const app = readFileSync(resolve(HERE, '../../App.tsx'), 'utf8')
const scan = readFileSync(resolve(HERE, '../Scan.tsx'), 'utf8')

/** 주석을 걷어낸 실제 코드. (Scan_allergen_wiring.test.ts 와 같은 규칙 — 줄 단위 블록만 걷는다) */
const code = src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('MyReports — 라우팅', () => {
  it('★ App.tsx 에 라우트가 등록돼 있다', () => {
    expect(app).toMatch(/path="\/scan\/reports"/)
    expect(app).toMatch(/element=\{<MyReports \/>\}/)
  })

  it('★★ 진입 경로가 Scan 화면의 상수와 «같은 값»이다 (갈라지면 눌러도 404 가 된다)', () => {
    expect(scan).toMatch(/MY_REPORTS_PATH\s*=\s*'\/scan\/reports'/)
  })

  it('★ 먹선 기능 플래그 아래에 있다 (스캔이 꺼져 있으면 이 화면도 없다)', () => {
    // ⚠ 첫 번째 `MEOKSEON_ENABLED` 는 import 줄이다. 라우트 블록을 짚는다.
    const block = app.slice(app.indexOf('{MEOKSEON_ENABLED && ('))
    expect(block.slice(0, block.indexOf('MEAL_ENABLED'))).toMatch(/\/scan\/reports/)
  })
})

describe('MyReports — 세 상태를 «섞지» 않는다', () => {
  it('★★★ 401 을 「불러오지 못했어요」로 뭉개지 않는다', () => {
    expect(code).toMatch(/MeokseonAuthError/)
    expect(code).toMatch(/need_login/)
  })

  it('★★★ 실패를 «조용히» 빈 목록으로 만들지 않는다', () => {
    // 실패 시 setItems([]) 로 넘어가는 형태가 되살아나지 않았다.
    expect(code).toMatch(/CONTRIBUTIONS_LOAD_ERROR/)
    const catchBlock = code.slice(code.indexOf('} catch (e) {'))
    expect(catchBlock.slice(0, 400)).not.toMatch(/setItems\(\[\]\)/)
  })

  it('★★ 빈 목록·조회 실패·로그인 필요가 각각 «다른» 문구를 쓴다', () => {
    expect(code).toMatch(/CONTRIBUTIONS_EMPTY/)
    expect(code).toMatch(/CONTRIBUTIONS_LOAD_ERROR/)
    expect(code).toMatch(/CONTRIBUTIONS_LOGIN_REQUIRED/)
  })

  it('★ 실패에는 다시 시도할 길이, 로그인 필요에는 로그인 길이 있다', () => {
    expect(code).toMatch(/onClick=\{load\}/)
    expect(code).toMatch(/loginPathWithReturn\(/)
  })
})

describe('MyReports — 판정·문구를 화면에서 만들지 않는다', () => {
  it('★★★ 상태 문구는 순수함수가 만든다 (없는 상태를 지어내지 않는다)', () => {
    expect(code).toMatch(/describeContributionStatus\(/)
    // 화면이 상태 문자열을 직접 분기하지 않는다.
    expect(code).not.toMatch(/'pending'/)
    expect(code).not.toMatch(/'approved'/)
    expect(code).not.toMatch(/접수됨/)
  })

  it('★★ 제목·시각·바코드 판정도 순수함수다', () => {
    expect(code).toMatch(/describeContributionTitle\(/)
    expect(code).toMatch(/formatReportedAt\(/)
    expect(code).toMatch(/contributionBarcode\(/)
  })

  it('★★ 영양 저장 여부를 화면에서 다시 판단하지 않는다', () => {
    expect(code).toMatch(/describeContributionNutrition\(/)
    expect(code).not.toMatch(/nutritionStatus\s*===\s*'ok'/)
  })

  it('★ 갈 곳이 없는 제보는 «왜» 없는지 말한다 (눌러도 아무 일 없는 버튼을 두지 않는다)', () => {
    expect(code).toMatch(/CONTRIBUTION_NO_BARCODE_NOTE/)
  })

  it('★★ 이력 조회에 device_id 를 쓰지 않는다 — 식별자는 계정이다', () => {
    expect(code).not.toMatch(/deviceId|device_id/)
  })
})
