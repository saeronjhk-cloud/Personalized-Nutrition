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

/**
 * 주석을 걷어낸 «실제 코드». 주석 안의 예시 문자열에 속지 않기 위해 필요하다.
 *
 * ★★★★ 2026-08-23 — **이 함수가 테스트를 눈멀게 하고 있었다.**
 *   종전 두 번째 줄은 `.replace(/\/\*[\s\S]*?\*\//g, '')` — 줄 중간의 `/*` 도 주석으로 봤다.
 *   그런데 이 파일이 검사하는 `Scan.tsx` 에는 파일 입력의 accept 값 「image 슬래시 별」이 있다.
 *   그 슬래시-별이 주석 시작으로 오인되면, 다음 블록 주석 끝까지 **16,449자가 통째로** 사라진다.
 *   그 안에 `id="report-product-name"` · `<AllergenCard result={analysis} />` 가 들어 있었다.
 *   ⇒ 이 파일의 단정 중 셋이 «코드가 있는데 없다»고 읽거나, 반대로 지워도 못 잡을 수 있었다.
 *   → 블록 주석은 **줄 맨 앞에서 열리고 줄 끝에서 닫히는 것만** 걷는다.
 *   (같은 함정을 `domain/meokseon/__tests__/additives.test.ts` 의 `codeOf` 도 피하고 있다.)
 */
const code = src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')            // JSX 주석 블록 {/* ... */}
  .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')          // 줄 단위 블록 주석만
  .replace(/^\s*\/\/.*$/gm, '')                          // 줄 주석

describe('Scan — 사진 제보 결과 알레르기 배선 (세션61 U60-7)', () => {
  it('AllergenCard 를 import 한다', () => {
    expect(code).toMatch(/import\s+AllergenCard\s+from/)
  })

  /**
   * ★ 2026-08-21 세션64 — 상태 이름이 `reportInfo` → `analysis` 로 바뀌었다.
   *   사진 제보가 «2단계»(읽어보기 → 보내기)가 되면서, 알레르기 카드가 붙는 자리도
   *   저장 «후» 화면 하나에서 **저장 «전» 미리보기 + 저장 후 확인 두 곳**으로 늘었다.
   *   ⇒ 지키는 것은 그대로다: 사진 제보 경로에 카드가 «붙어 있는가».
   *     이름이 바뀌었다고 이 단정을 지우면 배선을 지켜보는 것이 없어진다.
   */
  it('★ 사진 제보 결과(analysis)에 AllergenCard 를 붙인다 — 미리보기·완료 «두 곳» 모두', () => {
    const hits = code.match(/<AllergenCard\s+result=\{analysis\}/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  it('★★ 바코드 결과(result)의 카드도 그대로 남아 있다 — 한쪽을 고치며 다른 쪽을 지우지 않는다', () => {
    expect(code).toMatch(/<AllergenCard\s+result=\{result\}/)
  })

  it('⚠ 「목록이 비면 안 그리는」 한 줄이 되살아나지 않았다', () => {
    // 종전 형태: reportInfo.allergens.length > 0 && ...  (세션64 이후 이름은 analysis)
    expect(code).not.toMatch(/reportInfo\.allergens\.length\s*>\s*0/)
    expect(code).not.toMatch(/analysis\.allergens\.length\s*>\s*0/)
  })

  /**
   * ★★★ 세션64 — 「읽어보기」가 저장을 일으키지 않는다.
   *   `save='true'` 로 되돌아가면 사용자가 제품명을 확정하기 «전»에 저장되고,
   *   이름을 모르는 서버가 첫 원재료명(「정제수」)을 제품명으로 넣는 사고가 재발한다.
   *   화면은 「제품명 미인식」이라고 말하는데 DB 에는 「정제수」가 들어간다.
   */
  it('★★★ 제보 흐름이 2단계다 — 읽어보기(analyze) 와 보내기(confirm) 가 «따로» 있다', () => {
    expect(code).toMatch(/analyzePhotoReport/)
    expect(code).toMatch(/confirmPhotoReport/)
    // 종전의 한 방 저장 함수가 되살아나지 않았다.
    expect(code).not.toMatch(/submitPhotoReport/)
  })

  it('★★★ 제품명 입력란이 있고, 게이트를 «순수함수»에 맡긴다 (화면에서 다시 판단하지 않는다)', () => {
    expect(code).toMatch(/id="report-product-name"/)
    expect(code).toMatch(/canSubmitReport\(/)
    // ★ 2026-08-23 — 자동채움이 `seedProductNameForExisting` 으로 바뀌었다(등록된 제품 대응).
    //   이름이 바뀌었다고 단정을 지우면 배선을 지켜보는 것이 없어진다 — 둘 다 받는다.
    expect(code).toMatch(/seedProductName(ForExisting)?\(/)
  })

  /**
   * ★★★★ 2026-08-23 세션64 외부검토 §B — 「이미 등록된 제품」에 정보를 보태는 경로.
   *
   *   종전에는 제보 UI 가 `notFound`(= DB 에 없는 바코드)일 때만 떴다.
   *   ⇒ 영양정보가 빈 채로 한 번 등록되면 그 제품은 「있음」이 되어 **제보 화면이 다시 안 뜬다.**
   *     검토자 2명이 P0 로 지목: 「낮은 품질의 첫 제보가 미래의 고품질 제보를 차단한다.」
   *
   * ⚠ 이 단정들도 «약하다» — 소스 문자열을 볼 뿐 렌더 결과를 보지 않는다.
   *   되돌림 방지 장치이지 동작 증명이 아니다.
   */
  it('★★★★ 제보 경로가 미등록 바코드에만 묶여 있지 않다', () => {
    // 결손 판정을 화면에서 하지 않는다 — 순수함수를 부른다.
    expect(code).toMatch(/assessProduct\(/)
    // 분석·확정이 `notFound` 가 아니라 «제보 대상 바코드»를 쓴다.
    expect(code).toMatch(/reportBarcode/)
    expect(code).not.toMatch(/analyzePhotoReport\(\{\s*barcode:\s*notFound/)
  })

  it('★★★★ 제보 폼이 «한 벌»이다 — 미등록·기존 제품이 같은 함수를 쓴다', () => {
    expect(code).toMatch(/renderReportForm\('new'\)/)
    expect(code).toMatch(/renderReportForm\('existing'\)/)
  })

  it('★★ 기존 제품이면 제품명이 프리필된다 (사용자에게 없는 일을 시키지 않는다)', () => {
    expect(code).toMatch(/registeredName/)
    expect(code).toMatch(/seedProductNameForExisting\(registeredName/)
  })

  it('★★ 반려 사유를 잃지 않는다 — 저장 실패를 「감사합니다」로 말하지 않는다', () => {
    expect(code).toMatch(/rejectReason/)
  })

  /* ────────────────────────────────────────────────────────────────────────
   * 세션64b — 「부분 저장」배선. 종전 실패와 «같은 유형»이라 같은 방식으로 지킨다.
   *
   *   서버가 영양만 버리고 나머지를 저장하기 시작했다(`nutrition_status:'incomplete'`).
   *   화면이 `saved` 만 보고 「제보 감사합니다!」를 띄우면, 사용자는 영양성분표를
   *   찍어 보냈는데 그게 저장되지 않은 것을 **모른 채 떠난다.**
   *   = 세션61 U60-7 의 「목록이 비면 아무것도 안 그린다」와 정확히 같은 침묵이다.
   * ──────────────────────────────────────────────────────────────────────── */

  it('★★★ 부분 저장 판정이 배선돼 있다 (saved 만 보고 판단하지 않는다)', () => {
    expect(code).toMatch(/classifyPhotoReportOutcome\(/)
    expect(code).toMatch(/nutritionStatus/)
    expect(code).toMatch(/nutritionRejectCode/)
  })

  it('★★★★ 영양 안내를 «그린다» — 이 블록이 사라지면 침묵이 돌아온다', () => {
    expect(code).toMatch(/outcome\.nutritionNote/)
    expect(code).toMatch(/outcome\.headline/)
  })

  /**
   * ★★ 조건을 «사유 코드 목록»으로 걸면, 서버가 코드를 늘리는 순간 화면이 조용해진다.
   *   판정은 `photoReport.ts` 가 모르는 코드까지 문구로 바꿔 주므로,
   *   화면은 `nutritionNote` 의 «존재»만 보면 된다.
   */
  it('★★ 화면이 사유 코드를 직접 분기하지 않는다 (문구 정본은 domain 한 곳이다)', () => {
    expect(code).not.toMatch(/NO_NUTRIENTS/)
    expect(code).not.toMatch(/BASIS_UNKNOWN/)
    expect(code).not.toMatch(/PUBLIC_DATA_PROTECTED/)
  })

  /** ⚠ 외부 검토 결론 — 영양소 «개수»를 사용자 화면에 노출하지 않는다(내부 계측 전용). */
  it('★★ nutrient_count 를 화면에 쓰지 않는다', () => {
    expect(code).not.toMatch(/nutrientCount/)
    expect(code).not.toMatch(/nutrient_count/)
  })

  /** 말만 하고 길을 안 주면 안내가 아니다. 다시 찍을 수 있는 사유에는 버튼이 나온다. */
  it('★ 재촬영 길이 있다 (라벨 사진은 남기고 영양성분표만 다시 받는다)', () => {
    expect(code).toMatch(/retakeNutritionPhoto/)
    expect(code).toMatch(/outcome\.retakeable/)
  })

  /* ════════════════════════════════════════════════════════════════════════
   * 세션64c (2026-08-24) — 로그인 게이트 + 「제보 직후 결과」 배선.
   *
   * ⚠ 여기 단정들도 «약하다» — 소스 문자열을 볼 뿐 렌더 결과를 보지 않는다.
   *   되돌림 방지 장치이지 동작 증명이 아니다.
   * ════════════════════════════════════════════════════════════════════════ */

  describe('로그인 게이트 (제이 확정 2026-08-24 「제보도 로그인 필수」)', () => {
    it('★★★ 제보 버튼이 폼을 «직접» 열지 않는다 — 게이트를 거친다', () => {
      expect(code).toMatch(/openReportForm\(/)
      // 종전처럼 버튼 onClick 에서 바로 폼을 여는 형태가 되살아나지 않았다.
      expect(code).not.toMatch(/onClick=\{\(\)\s*=>\s*\{?\s*setReportOpen\(true\)/)
    })

    it('★★★ 게이트가 «토큰»을 실제로 확인한다 (상태만 보고 열지 않는다)', () => {
      expect(code).toMatch(/getMeokseonAccessToken\(/)
    })

    it('★★★★ 스캔·조회 경로에는 게이트가 «없다» — 무료 후킹을 막지 않는다', () => {
      // 바코드 조회·검색 함수가 로그인 검사를 거치지 않는다.
      const lookup = code.slice(code.indexOf('async function lookupBarcode'), code.indexOf('async function doSearch'))
      expect(lookup.length).toBeGreaterThan(0)
      expect(lookup).not.toMatch(/getMeokseonAccessToken|openReportForm|loginGateOpen/)
      // 카메라 시작도 마찬가지다.
      const start = code.slice(code.indexOf('async function startScan'), code.indexOf('async function lookupBarcode'))
      expect(start).not.toMatch(/getMeokseonAccessToken|loginGateOpen/)
    })

    it('★★ 게이트 문구를 화면에서 «다시 적지» 않는다 (정본은 domain/meokseon/reportAuth.ts)', () => {
      expect(code).toMatch(/REPORT_LOGIN_HEADLINE/)
      expect(code).toMatch(/REPORT_LOGIN_WHY/)
      // 「스캔은 그대로 된다」를 반드시 함께 그린다.
      expect(code).toMatch(/REPORT_LOGIN_SCAN_OK/)
      expect(code).not.toMatch(/제보하려면 로그인이 필요해요/)
    })

    it('★★★ 401 을 일반 실패로 뭉개지 않는다', () => {
      expect(code).toMatch(/MeokseonAuthError/)
      expect(code).toMatch(/handleAuthError\(/)
    })

    it('★★★ 흐름 도중 401 에서 «자동으로» 로그인 화면으로 옮기지 않는다 (사진이 사라진다)', () => {
      // 사실을 말하는 문구와 «버튼»이 있다. 자동 이동이면 이 둘이 필요 없다.
      expect(code).toMatch(/AUTH_PHOTO_LOST_NOTICE/)
      expect(code).toMatch(/AUTH_RELOGIN_CTA/)
      // handleAuthError 안에서 navigate 를 부르지 않는다.
      const fn = code.slice(code.indexOf('function handleAuthError'))
      const body = fn.slice(0, fn.indexOf('\n  }') + 4)
      expect(body).not.toMatch(/navigate\(/)
    })

    it('★★ 로그인 뒤 «원래 하던 제보»로 돌아온다 — 바코드를 URL 로 들고 간다', () => {
      expect(code).toMatch(/loginPathWithReturn\(/)
      expect(code).toMatch(/reportReturnPath\(/)
      expect(code).toMatch(/restoreFromLogin\(/)
      expect(code).toMatch(/report=1/)
    })
  })

  describe('제보 직후 결과 표시 (제이 지시 2026-08-24 「보여줄 수 있는 부분만」)', () => {
    it('★★★ 영양·신호등 판정을 화면에서 «다시 하지» 않는다 — 순수함수 한 곳이다', () => {
      expect(code).toMatch(/buildReportNutrition\(/)
      // 관문을 두 곳으로 가르지 않는다: 화면은 show 만 본다.
      expect(code).toMatch(/reportNutrition\.show/)
      expect(code).toMatch(/reportNutrition\.showLights/)
    })

    it('★★★★ 「저장된 경우에만」이 지켜진다 — 판정 입력이 서버 nutrition_status 다', () => {
      const call = code.slice(code.indexOf('buildReportNutrition({'))
      const body = call.slice(0, call.indexOf('})') + 2)
      expect(body).toMatch(/nutritionStatus:\s*confirmed\.nutritionStatus/)
      expect(body).toMatch(/basis:\s*analysis\.nutritionBasis/)
      expect(body).toMatch(/trafficLight:\s*analysis\.trafficLight/)
    })

    it('★★ 서버가 이미 주던 것들을 «그린다» — 개수만 말하던 상태로 되돌아가지 않았다', () => {
      expect(code).toMatch(/analysis\.ingredients/)
      expect(code).toMatch(/buildAdditiveList\(\{\s*additives:\s*analysis\.additives/)
    })

    it('★★★ 첨가물 등급(4색)은 «꺼진 채»다 — 화면에서 켜지 않는다', () => {
      expect(code).toMatch(/SHOW_RISK_GRADE/)
      // `SHOW_RISK_GRADE = true` 로 덮어쓰는 코드가 없다.
      expect(code).not.toMatch(/SHOW_RISK_GRADE\s*=\s*true/)
    })

    it('★★ 신호등이 뜨면 「초록도 안전 인증이 아니다」가 «항상» 함께 나간다', () => {
      expect(code).toMatch(/TRAFFIC_LIGHT_CAPTION/)
    })

    it('★★ 신호등을 못 그린 이유를 말한다 — 침묵하지 않는다', () => {
      expect(code).toMatch(/reportNutrition\.note/)
    })

    it('★ 「내가 보낸 제보」로 가는 길이 있다', () => {
      expect(code).toMatch(/MY_REPORTS_PATH/)
      expect(code).toMatch(/CONTRIBUTIONS_TITLE/)
    })
  })
})
