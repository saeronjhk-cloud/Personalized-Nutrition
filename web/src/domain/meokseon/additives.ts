/**
 * 첨가물 개별 표시 판정 — 순수 함수(렌더 비의존, 테스트 대상).
 *
 * ★ 왜 생겼나 (2026-08-14, 세션64)
 *   `Scan.tsx` 는 `risk_summary.by_color` 의 **개수만** 4색 pill 로 그렸다.
 *   아몬드브리즈 언스위트를 스캔하면 「첨가물 7종 / 안전 5 · 허용 1 · 주의 1 · 위해 0」이 나오는데,
 *   **그 「주의 1」이 무엇인지 알 방법이 없었다.** 서버는 개별 첨가물의 이름·용도·근거를
 *   처음부터 전부 내려보내고 있었다(`GET /api/products/:barcode/additives`). 화면만 안 썼다.
 *
 * ★★ 이 파일이 지키는 것은 «보여주기»가 아니라 **«숫자만 던지지 않기»** 다.
 *
 *   ① IARC 등급을 «숫자만» 내면 과다경고가 된다.
 *      아스파탐은 IARC **2B** 인데, 2B 는 알로에베라 잎 추출물·아시아식 절임채소와 같은 칸이다.
 *      「IARC 2B」만 보여주면 사용자는 1군(석면·담배연기)과 구분하지 못한다.
 *      → 등급 «설명»이 수치와 «같은 화면»에 있어야 한다. 툴팁 뒤에 숨기지 않는다.
 *
 *   ② `adi_type` 은 값마다 의미가 **정반대**다.
 *      `not_specified` = 독성이 낮아 «한도를 정할 필요가 없다»  (좋은 신호)
 *      `not_established` = 데이터가 부족해 «정하지 못했다»       (나쁜 신호)
 *      `adi_value` 숫자만 믿고 표시하면 이 둘이 똑같이 빈칸이 된다.
 *      → `adi_type` 을 반드시 함께 읽고 유형별 한국어 문구를 낸다.
 *      ⚠ 실측(마스터 665종): `numerical` 인데 `adi_value` 가 null 인 행이 **15건** 있다.
 *        `not_specified` 인데 값이 있는 행도 2건 있다. 유형만 보고 값을 가정하면 안 된다.
 *
 *   ③ 4색 «밖»인 첨가물이 조용히 사라지면 안 된다.
 *      `productService.js:120` 은 `a.mfras_grade || a.risk_color || 'gray'` 를 내고,
 *      `mfras_grade` ENUM 에는 `'blue'`(v1 잔재, 사용 금지)까지 들어 있다
 *      (`000_baseline.sql:104`). 그런데 `risk_summary.by_color` 도 앱도 4색만 센다/그린다.
 *      ⇒ 등급이 4색 밖이면 **「7종」이라 써 놓고 pill 합계가 6** 이 된다. 그 1종은 화면에서 증발한다.
 *      2026-08-12 실측 발생률 0.00% 이지만 방어 코드는 서버에 남아 있다.
 *      → 알 수 없는 색은 **버리지 않고** 「등급 미상」으로 «보이게» 만든다. 0% 라고 무시하지 않는다.
 *
 * 서버 계약 — ★ 인수인계 문구가 아니라 코드에서 확인한 것 (2026-08-14)
 *   `GET /api/products/:barcode/additives`
 *     → `productService.getProductAdditives()` (productService.js:452~478)
 *     → `additives` 는 `productModel.getAdditives()` 의 **DB 행 그대로**다.
 *       ⚠⚠ `buildMfras()`(productService.js:111~150)가 만드는 `{name, function, color, score}` 모양이
 *          **아니다.** 그건 `GET /api/products/:barcode` 의 `mfras.additives` 쪽이다.
 *          이 엔드포인트의 실제 필드는 `name_ko` · `category` · `mfras_grade` · `mfras_total` 이다.
 *     실제 행 컬럼(productModel.js:245~274 SELECT 절):
 *       additive_id, name_ko, name_en, e_number, ins_no,
 *       category, description, max_daily_intake,
 *       risk_grade, risk_color,                          (v1 호환)
 *       mfras_total, mfras_grade,                        (v2 점수·색)
 *       dim_a_toxicity … dim_e_data_quality,
 *       iarc_group, adi_value, adi_type, edi,
 *       genotox_status, regulatory_status, last_eval_year,
 *       purposes, usage_type, mfras_rationales,
 *       amount, unit                                     (product_additives)
 *   ⚠ `adi_value` · `edi` 는 **VARCHAR(50)** 이다(008_mfras_v2.sql:59~60). 숫자가 아니라 문자열로 온다.
 *   ⚠ `mfras_total` · `dim_*` 는 NUMERIC 이지만 `numifyAll` 이 숫자로 좁혀 준다(productModel.js:102).
 *     그래도 여기서는 둘 다 견딘다 — 경계에서 한 번 더 좁히는 값이 저렴하다.
 *
 * 참고 선례: 같은 폴더 `allergens.ts` (세션53~61). 판정은 여기, 그리기는 컴포넌트.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ★★★★ 2026-08-23 세션64 외부검토 — **4색 등급 «표시»를 껐다.** (계산은 그대로 둔다)
 *
 *   검토자 4명 전원 일치. 근거:
 *     · 초록 327종 중 **314종(96%)** 이 계산이 아니라 자동 규칙으로 «찍힌» 값
 *     · `iarc_group` 이 **98.6% 비어 있음**
 *     · IARC 1군으로 올려도 다른 차원이 낮으면 노랑에 머묾 (구조적 결함)
 *     · 라벨의 첨가물 중 **33.3%가 마스터에 매칭되지 않아 목록에서 조용히 사라짐**
 *
 *   ⇒ 등급을 «지우지» 않는다. `SHOW_RISK_GRADE` 하나로 «표시»만 끈다.
 *     재구축이 끝나면 그 상수를 `true` 로 되돌리면 종전 화면이 그대로 돌아온다.
 *     (`alerts`·`calm`·`counts` 를 계속 계산해 두는 이유가 이것이다.)
 *
 * ★ 정렬 — **서버 순서를 그대로 쓰면 안 된다.**
 *   `productModel.getAdditives()` 의 `ORDER BY COALESCE(a.mfras_total,0) DESC, …` 는
 *   **위해성 점수 내림차순**이다. 등급 라벨만 지우고 이 순서를 남기면
 *   「위에 있는 게 더 위험한 것」이라는 판정이 «순서로» 계속 새어 나간다.
 *   그렇다고 「제품 표시사항 순서」를 쓸 수도 없다 — 서버 응답에 그 순서가 없다(확인함).
 *   ⇒ 판정이 섞이지 않는 유일한 기준인 **이름 가나다순**으로 다시 정렬한다.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * ★★★★ 4색 위해성 등급을 «화면에» 표시할 것인가. (2026-08-23 외부검토로 false)
 *
 * false 인 동안 화면에서 사라지는 것 — 전부 «표시»만 꺼진다. 계산은 계속 돈다.
 *   ① 이름 옆 등급 라벨(「주의」 등 색 글씨)  ② 색으로 칠한 왼쪽 테두리·배경
 *   ③ 「안전 5 · 허용 1 · 주의 1 · 위해 0」 4색 pill  ④ 「위해성 3.6 / 10」 점수
 *   ⑤ 등급 기준 정렬·펼침/접기 (→ 이름 가나다순 단일 목록으로 대체)
 *   ⑥ 「4색으로 나타내요」 안내문 · MFRAS 출처 문구
 *
 * **되살리는 법**: 여기를 `true` 로 바꾸면 끝이다. 소비처는 두 곳뿐이다 —
 *   `components/AdditiveList.tsx` · `pages/Scan.tsx`. 둘 다 `SHOW_RISK_GRADE` 로 분기한다.
 *   (`__tests__/additives.test.ts` 가 종전 등급 로직을 계속 지키고 있으므로
 *    되살릴 때 무엇이 깨졌는지 테스트가 먼저 말해 준다.)
 *
 * ⚠ 타입을 `boolean` 으로 «명시»한다. 리터럴 타입(`false`)이면 TS 가 반대 분기를
 *   도달 불가로 좁혀 버려서, 꺼져 있는 동안 되살릴 코드의 타입 검사가 멈춘다.
 */
export const SHOW_RISK_GRADE: boolean = false

/* ──────────────────────────────────────────────────────────────────────────
 * 1. 타입
 * ────────────────────────────────────────────────────────────────────────── */

/** 화면이 그리는 색. `unknown` = 서버가 4색 밖의 값을 줬거나 등급이 없다. 「안전」이 아니다. */
export type AdditiveColor = 'green' | 'yellow' | 'orange' | 'red' | 'unknown'

/** 국제암연구소(IARC) 발암성 분류. `null` = 등재 이력이 없다(줄을 그리지 않는다). */
export interface IarcInfo {
  /** 서버가 보낸 원문 등급 문자열(정규화 후). 예: '2B' */
  group: string
  /** 등급 한 줄 요약. **수치와 같은 화면에 반드시 함께 낸다.** */
  label: string
  /** 오해를 막는 보조 문장. 같은 칸에 있는 익숙한 예시를 든다. */
  note: string
  /** 이 저장소가 설명 문구를 갖고 있지 않은 등급인가(= 문구 검토 필요) */
  unmapped: boolean
}

/** 일일섭취허용량(ADI). **항상 non-null** — 「정보 없음」도 하나의 상태로 말한다. */
export interface AdiInfo {
  /** 정규화된 `adi_type`. 서버가 값을 안 줬으면 `'missing'`. */
  type: string
  /** 한 줄 요약. 수치가 있으면 수치를 포함한다. */
  label: string
  /** 유형의 «의미» 설명. `not_specified` 와 `not_established` 를 가르는 문장이 여기 있다. */
  note: string
  /** 파싱된 수치(mg/kg 체중/일). 유형이 numerical 이어도 null 일 수 있다(실측 15건). */
  value: number | null
  /** 이 저장소가 문구를 확정하지 못한 유형인가(= 제이 승인 대기) */
  unmapped: boolean
}

export interface AdditiveView {
  /** React key 용. additive_id 가 없으면 이름+순번으로 만든다(중복 이름 방어). */
  key: string
  name: string
  color: AdditiveColor
  /**
   * '안전' | '허용' | '주의' | '위해' | '등급 미상'
   * ⚠ `SHOW_RISK_GRADE === false` 인 동안 **화면에 그리지 않는다.** 값은 계속 채운다.
   */
  colorLabel: string
  /** 서버가 실제로 보낸 색 문자열. `unknown` 일 때 무엇이 왔는지 잃지 않는다(진단용). */
  rawColor: string | null
  /** 먹선 위해성 점수 0~10. **높을수록 주의**. 없으면 null. */
  score: number | null
  /** 「일반적 용도」의 값. 결측이면 `FUNCTION_UNKNOWN`. 빈칸을 그대로 내지 않는다. */
  functionText: string
  /** functionText 가 실제 데이터인가(false = 결측 대체 문구) */
  functionKnown: boolean
  /** functionText 의 출처. 'category' | 'purposes' | 'none' */
  functionSource: 'category' | 'purposes' | 'none'
  /**
   * 식품첨가물 국제번호. 예: `'INS 951'`. 없으면 null.
   * ⚠ **E-number 는 만들지 않는다.** 한국 식품첨가물공전은 INS 를 쓰고 E-number 는 법정 표시가
   *   아니다. 유럽 실증에서 E 표기는 「자연스럽지 않다」는 인식을 높이는 것으로 나타났다.
   *   행에 `e_number` 컬럼이 있어도 여기서 «읽지 않는다».
   */
  ins: string | null
  iarc: IarcInfo | null
  adi: AdiInfo
  /** 이 줄을 접지 않고 펼친 채로 둘 것인가(주황·빨강·등급미상) */
  alert: boolean
}

export interface AdditiveListView {
  /** 서버 `risk_summary.total`. 「현재 인식한 첨가물 N개」의 N. */
  total: number
  /**
   * ★ 등급 표시가 꺼져 있는 동안 화면이 쓰는 **단일 목록**. 이름 가나다순.
   *
   * 서버가 준 순서(`mfras_total DESC`)를 그대로 쓰지 «않는» 이유는 파일 상단 주석 참조 —
   * 등급 라벨만 지우고 위해성 정렬을 남기면 판정이 «순서로» 계속 새어 나간다.
   * 「표시사항 순서」는 응답에 없다(서버 SELECT 확인함) — 없는 것을 있는 척하지 않는다.
   */
  items: AdditiveView[]
  /** 펼친 채로 보여줄 목록 — 위해 → 주의 → 등급 미상 순. (등급 표시 ON 일 때만 쓴다) */
  alerts: AdditiveView[]
  /** 접어 두고 「펼치기」로 여는 목록 — 허용 → 안전 순. (등급 표시 ON 일 때만 쓴다) */
  calm: AdditiveView[]
  /** 우리가 «직접 센» 색별 개수. 서버 `by_color` 를 믿지 않는다(4색 밖을 못 센다). */
  counts: Record<AdditiveColor, number>
  /**
   * ★ 「N종」이라 써 놓고 목록이 그보다 «짧은» 개수.
   *   서버 `total` 은 `additives.length` 이므로 정상 응답에서는 0 이다.
   *   0 이 아니면 화면이 무언가를 잃고 있다는 뜻이므로 사용자에게 말해야 한다.
   */
  unlisted: number
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2. 문구 — ★★ 안전 계약이다. 바꾸려면 제이 승인이 필요하다.
 * ────────────────────────────────────────────────────────────────────────── */

export const COLOR_LABEL: Record<AdditiveColor, string> = {
  green: '안전',
  yellow: '허용',
  orange: '주의',
  red: '위해',
  // ⚠ 「미상」이지 「안전」이 아니다. 알레르기 축의 「미수집 ≠ 없음」과 같은 도크트린이다.
  unknown: '등급 미상',
}

/** 등급 미상 줄에 함께 내는 설명. 침묵하면 사용자가 「안전」으로 읽는다. */
export const UNKNOWN_COLOR_NOTE =
  '아직 위해성 등급이 매겨지지 않은 첨가물이에요. 안전하다는 뜻은 아니에요.'

/* ── 등급 표시 OFF 동안의 문구 (2026-08-23 외부검토) ─────────────────────────── */

/**
 * A7 — 섹션 헤더에 **한 번만** 낸다. 행마다 붙이지 않는다(붙이면 그 자체가 경고가 된다).
 *
 * ⚠ 「이 앱을 믿지 마세요」로 읽히면 실패다. 이 문장이 하는 일은
 *   **어디까지 사실을 말할 수 있고 어디부터 아직 판단하지 않는지 경계를 보여주는 것**이다.
 * ⚠ 앱의 다른 문구는 해요체인데 이 문장만 합니다체다 —
 *   검토 결론에 실린 «원문 그대로»를 쓴 것이다. 문체 통일은 제이 판단 대상으로 남긴다.
 */
export const GRADE_HIDDEN_NOTICE =
  '첨가물 위험 등급은 현재 평가 체계를 재검토하고 있어 표시하지 않습니다. '
  + '아래는 제품 표시사항에서 인식한 첨가물과 일반적 용도입니다.'

/**
 * A2 — 개수 문구.
 *
 * ⚠ 「첨가물 7종」은 **사실보다 강한 주장**이다. 세션64 실측: 라벨에 적힌 첨가물의
 *   **33.3%** 가 마스터에 매칭되지 않아 목록에 아예 오르지 못한다.
 *   ⇒ 「이 제품의 첨가물은 7개」가 아니라 「지금 «인식한» 것이 7개」라고 말한다.
 */
export function describeAdditiveCount(n: number): string {
  return `제품 표시사항에서 현재 인식한 첨가물 ${n}개`
}

/** A2 각주 — 왜 「N개」가 전부가 아닌가. 위 33.3% 실측이 근거다. */
export const ADDITIVE_COUNT_CAVEAT =
  '라벨에 적혀 있어도 아직 대조표에 없는 첨가물은 이 목록에 나오지 않아요. 여기 보이는 것이 전부가 아닐 수 있어요.'

/** A5 — 「기능」이 아니라 「일반적 용도」다. 화면 문구의 정본은 여기 한 곳. */
export const FUNCTION_LABEL = '일반적 용도'

/**
 * A5 각주 — 근거: Codex CXG 36-1989.
 *   한 첨가물은 여러 technological purpose 를 가질 수 있고, 실제 제품에서의 용도는 제조자가 정한다.
 *   우리 `category` 는 «마스터의 일반적 용도»이지 «이 제품에서의 기능»이 아니다. 단정하면 안 된다.
 *
 * ⚠ 값 뒤에 「등」을 붙여 표시하는 방법도 있지만 그건 데이터 문자열을 손대는 것이라
 *   쓰지 않았다. 같은 뜻을 각주 한 줄로 말한다.
 */
export const FUNCTION_CAVEAT =
  '「일반적 용도」는 그 첨가물이 흔히 쓰이는 쓰임새예요. 이 제품에서 실제로 어떤 용도로 쓰였는지와는 다를 수 있어요.'

/**
 * A8 각주 — 용도 결측을 «경고»로 읽지 않게.
 *   실측: 마스터 기준 결측 11.58% 이지만 **실제 화면에 뜨는 줄 기준 2.38%**(40줄 중 1줄 꼴)다.
 */
export const FUNCTION_MISSING_CAVEAT = '용도 정보의 유무는 안전성 평가를 뜻하지 않습니다.'

/** A4 — IARC·ADI 를 감싸는 접힌 상세의 제목. 기본 줄에는 이름과 용도만 남는다. */
export const EVIDENCE_TOGGLE_LABEL = '기관 평가 정보 보기'

/** 등급 표시 OFF 일 때의 하단 출처 문구. MFRAS 등급을 언급하지 않는다(지금 안 보여주므로). */
export const EVIDENCE_SOURCE_NOTE =
  '기관 평가 정보는 국제기구(JECFA·EFSA·IARC)가 공개한 자료를 정리한 것이에요. '
  + '진단이나 의학적 조언이 아니라 생활관리 참고 정보예요.'

/**
 * IARC 발암성 분류 설명.
 *
 * ⚠ 예시를 고를 때 «지금도 그 칸에 있는» 것만 쓴다.
 *   커피는 2016년에 2B 에서 3군으로 재분류됐다. 옛 예시를 쓰면 문구 자체가 틀린 정보가 된다.
 * ⚠ IARC 4군은 2019년에 폐지됐다. 남겨 두면 옛 자료에서 흘러들 수 있으므로 문구는 둔다.
 *
 * ★★ 2026-08-23 외부검토 A9 — **비대칭을 고쳤다.**
 *   종전에는 1군 note 에만 「'얼마나 위험한가'가 아니라 '발암성이 확인됐는가'」가 있었고
 *   2A·2B·3 에는 없었다. 가장 흔한 등급(2B)에 그 문장이 없으면, 그 등급을 본 사용자는
 *   IARC 를 «위험의 크기»로 읽는다. 2A·2B·3 에도 같은 취지를 넣는다.
 *   ⚠ 기존 예시(붉은 고기·알로에베라 잎 추출물·절임채소)는 **정확하다. 바꾸지 말 것.**
 */
const IARC_TABLE: Record<string, { label: string; note: string }> = {
  '1': {
    label: '1군 — 사람에게 발암성이 있음 (근거 충분)',
    note: '석면·담배연기와 같은 분류예요. 「얼마나 위험한가」가 아니라 「발암성이 확인됐는가」를 나타내는 등급이에요.',
  },
  '2A': {
    label: '2A군 — 사람에게 발암성이 있을 가능성이 높음 (근거 제한적)',
    note: '붉은 고기·65도 이상의 뜨거운 음료와 같은 분류예요. 사람 대상 근거는 제한적이고 동물 실험 근거가 충분한 경우예요. 이 분류는 실제 위험의 크기가 아니라 근거의 강도를 나타내요.',
  },
  '2B': {
    label: '2B군 — 발암 가능성이 있음 (근거가 제한적이거나 부족)',
    note: '알로에베라 잎 추출물·절임채소와 같은 분류예요. 석면·담배가 속한 1군과는 다른 칸이에요. 이 분류는 실제 위험의 크기가 아니라 근거의 강도를 나타내요.',
  },
  '3': {
    label: '3군 — 발암성을 분류할 수 없음 (근거 부족)',
    note: '발암성이 «없다»는 뜻이 아니라, 판단할 근거가 아직 부족하다는 뜻이에요. 이 분류는 실제 위험의 크기가 아니라 근거의 강도를 나타내요.',
  },
  '4': {
    label: '4군 — 사람에게 발암성이 없을 것으로 추정 (2019년 폐지된 분류)',
    note: 'IARC 가 2019년에 없앤 등급이에요. 옛 자료에서 넘어온 값일 수 있어요.',
  },
}

/**
 * ADI(일일섭취허용량) 유형별 문구.
 *
 * 근거: `week1_pipeline/06_mfras_scoring_v2.py:66~82` 이 점수 A 차원에서 쓰는 분기와 같은 어휘.
 *   not_specified → 1점(독성 매우 낮음) · not_established → 7점(데이터 불충분)
 *   withdrawn / not_acceptable → 10점 + 강제 빨강 · numerical → 값에 따라 2~8점
 *
 * ⚠⚠ `limited`(27종) · `specified`(4종) · `not_evaluated`(96종) 는
 *   **점수 함수도 모르는 값**이다 — 위 파일에서 어느 분기에도 걸리지 않고
 *   「ADI 정보 불완전: 기본 중간값 5」로 떨어진다. 저장소 어디에도 정의가 없다.
 *   `not_evaluated` 는 이름만으로 의미가 명확해 문구를 확정했지만,
 *   `limited` · `specified` 는 **의미를 확인하지 못했다.** 추측해서 안내하면 그 자체가 오정보이므로
 *   「확인 중」이라고 말하고 `unmapped: true` 로 표시한다. → 제이 승인 필요.
 */
const ADI_TABLE: Record<string, { label: string; note: string; unmapped?: boolean }> = {
  not_specified: {
    label: 'ADI 「설정 안 함(not specified)」',
    note: '독성이 매우 낮아 «수치 한도를 정할 필요가 없다»고 국제기구가 판단한 경우예요. 데이터가 없어서가 아니에요.',
  },
  not_established: {
    label: 'ADI 「설정 못 함(not established)」',
    note: '안전성 데이터가 부족해 허용량을 정하지 «못한» 경우예요. 위의 「설정 안 함」과는 정반대 의미예요.',
  },
  withdrawn: {
    label: 'ADI 「철회됨(withdrawn)」',
    note: '예전에 정해 두었던 허용량을 안전성 우려로 취소한 경우예요.',
  },
  not_acceptable: {
    label: 'ADI 「불허(not acceptable)」',
    note: '식품 첨가물로 받아들일 수 없다고 판단한 경우예요.',
  },
  not_evaluated: {
    label: 'ADI 평가 이력 없음(not evaluated)',
    note: '국제기구가 아직 평가하지 않았어요. 안전하다는 뜻도, 위험하다는 뜻도 아니에요.',
  },
  limited: {
    label: 'ADI 기록 「limited」 — 의미 확인 중',
    note: '원자료에 「limited」로 기록돼 있는데, 그 의미를 아직 확정하지 못했어요. 잘못 안내하지 않으려고 수치로 말하지 않아요.',
    unmapped: true,
  },
  specified: {
    label: 'ADI 기록 「specified」 — 의미 확인 중',
    note: '원자료에 「specified」로 기록돼 있는데, 그 의미를 아직 확정하지 못했어요. 잘못 안내하지 않으려고 수치로 말하지 않아요.',
    unmapped: true,
  },
}

/** ADI 수치가 있을 때의 공통 설명. */
const ADI_NUMERIC_NOTE =
  '국제기구(JECFA·EFSA)가 정한, 평생 매일 먹어도 건강상 문제가 없다고 보는 하루 섭취량이에요. 체중 1kg당 기준이에요.'

/** `numerical` 이라고 적혀 있는데 수치가 없는 경우(마스터 665종 중 15건 실측). */
const ADI_NUMERIC_NO_VALUE = {
  label: 'ADI 수치가 저장돼 있지 않아요',
  note: '허용량이 정해져 있다고 기록돼 있지만 값이 들어와 있지 않아요. 확인 중이에요.',
}

/** `adi_type` 자체가 없는 경우. */
const ADI_MISSING = {
  label: 'ADI 정보 없음',
  note: '허용량 정보가 저장돼 있지 않아요. 안전하다는 뜻은 아니에요.',
}

/**
 * 「일반적 용도」가 결측일 때. 빈칸을 그대로 내지 않는다.
 *
 * ★ 2026-08-23 A8 — 문구를 `'용도 정보 없음'` → `'현재 정보 없음'` 으로 바꿨다.
 *   화면에서 `일반적 용도: 현재 정보 없음` 한 줄로 «있는 줄과 같은 모양»으로 나간다.
 *   경고처럼 보이게 하지 않는다(회색 중립). 결측은 40줄 중 1줄 꼴(2.38%)이다.
 */
export const FUNCTION_UNKNOWN = '현재 정보 없음'

/* ──────────────────────────────────────────────────────────────────────────
 * 3. 정규화 헬퍼
 * ────────────────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

/** 첫 번째로 «비어 있지 않은» 문자열을 고른다. */
function pickStr(row: Row, keys: string[]): string {
  for (const k of keys) {
    const s = str(row[k])
    if (s) return s
  }
  return ''
}

/**
 * 숫자 좁히기. PG NUMERIC 은 문자열로 오고, `adi_value`·`edi` 는 아예 VARCHAR 다.
 * 숫자로 읽히지 않으면 **0 으로 만들지 않고 null 을 낸다** — 0 은 「없음」과 뜻이 다르다.
 */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const KNOWN_COLORS: AdditiveColor[] = ['green', 'yellow', 'orange', 'red']

/**
 * 색 정규화.
 * ⚠ 4색이 아니면 **버리지 않고** `unknown` 으로 «남긴다». 'gray' 도 'blue' 도 여기로 온다.
 */
export function normalizeColor(raw: unknown): AdditiveColor {
  const s = str(raw).toLowerCase()
  return (KNOWN_COLORS as string[]).includes(s) ? (s as AdditiveColor) : 'unknown'
}

/**
 * IARC 등급 해석.
 * `null`/빈값 → `null` (등재 이력이 없다 = 줄을 그리지 않는다).
 * 표에 없는 값이면 «숨기지 않고» 원문을 그대로 보여주고 `unmapped` 를 세운다.
 */
export function describeIarc(raw: unknown): IarcInfo | null {
  const s = str(raw).toUpperCase().replace(/^GROUP\s*/, '')
  if (!s) return null
  const hit = IARC_TABLE[s]
  if (hit) return { group: s, label: hit.label, note: hit.note, unmapped: false }
  return {
    group: s,
    label: `IARC ${s}군 — 등급 설명이 아직 준비되지 않았어요`,
    note: '국제암연구소가 매긴 분류인데, 이 앱이 아직 설명 문구를 갖고 있지 않아요.',
    unmapped: true,
  }
}

/**
 * ADI 해석. **유형과 수치를 «함께» 읽는다.**
 * 유형만 보고 수치를 가정하지 않고, 수치만 보고 유형을 가정하지도 않는다.
 */
export function describeAdi(rawType: unknown, rawValue: unknown): AdiInfo {
  const type = str(rawType).toLowerCase()
  const value = num(rawValue)

  // ① 수치가 실제로 있으면 유형과 무관하게 수치를 먼저 말한다.
  //    (실측: `not_specified` 인데 값이 있는 행이 2건 있다 — 유형만 믿으면 그 값이 사라진다.)
  if (value !== null) {
    const extra = ADI_TABLE[type]
    return {
      type: type || 'missing',
      label: `ADI ${value} mg/kg 체중/일`,
      note: extra ? `${ADI_NUMERIC_NOTE} ${extra.note}` : ADI_NUMERIC_NOTE,
      value,
      unmapped: !!extra?.unmapped,
    }
  }

  // ② 수치가 없다 — 유형이 전부를 말한다.
  if (!type) return { type: 'missing', ...ADI_MISSING, value: null, unmapped: false }

  const hit = ADI_TABLE[type]
  if (hit) return { type, label: hit.label, note: hit.note, value: null, unmapped: !!hit.unmapped }

  // ③ 「수치가 있다」고 적혀 있는데 수치가 없는 경우 (실측 15건)
  if (type === 'numerical') {
    return { type, ...ADI_NUMERIC_NO_VALUE, value: null, unmapped: false }
  }

  // ④ 처음 보는 유형 — 숨기지 않는다. 원문을 그대로 보여주고 검토 대상으로 남긴다.
  return {
    type,
    label: `ADI 정보 「${str(rawType)}」`,
    note: '이 앱이 아직 설명 문구를 갖고 있지 않은 표기예요. 안전하다는 뜻은 아니에요.',
    value: null,
    unmapped: true,
  }
}

/**
 * 「이름 + 기능」의 기능.
 *
 * ⚠ 실측(마스터 665종): `category` 결측 **77종 = 11.58%**.
 *   그중 55종은 `purposes`(TEXT[]) 에 용도가 들어 있다 → 대체하면 잔여 결측이 **22종 = 3.31%** 로 준다.
 *   실물 라벨 67건 기준으로는 등장 슬롯 285건 중 결측이 17건(5.96%) → **3건(1.05%)** 로 줄었다.
 *   (예: 신라면의 `5'-리보뉴클레오티드이나트륨` 은 category 가 없고 purposes 가 「향미증진제」다.)
 *   남는 결측은 빈칸으로 두지 않고 `용도 정보 없음` 으로 «말한다».
 */
export function describeFunction(row: Row): {
  text: string
  known: boolean
  source: 'category' | 'purposes' | 'none'
} {
  // `category` 우선. `function` 은 다른 엔드포인트(buildMfras) 모양을 받아도 견디기 위한 것.
  const cat = pickStr(row, ['category', 'function'])
  if (cat) return { text: cat, known: true, source: 'category' }

  const purposes = row['purposes']
  if (Array.isArray(purposes)) {
    const list = purposes.map(str).filter(Boolean)
    if (list.length) return { text: list.join(' · '), known: true, source: 'purposes' }
  } else {
    // TEXT[] 가 문자열로 직렬화돼 오는 경우도 견딘다(드라이버·프록시 차이).
    const s = str(purposes).replace(/^\{|\}$/g, '')
    if (s) {
      const list = s.split(',').map((x) => x.replace(/^"|"$/g, '').trim()).filter(Boolean)
      if (list.length) return { text: list.join(' · '), known: true, source: 'purposes' }
    }
  }

  return { text: FUNCTION_UNKNOWN, known: false, source: 'none' }
}

/**
 * 식품첨가물 국제번호(INS).
 *
 * ★ 2026-08-23 A3 — **E-number 는 읽지 않는다.**
 *   한국 식품첨가물공전이 쓰는 것은 INS 번호이고 E-number 는 국내 법정 표시가 아니다.
 *   유럽 실증에서 E 표기는 「자연스럽지 않다」는 인식을 높이는 것으로 나타났다.
 *   ⇒ 행에 `e_number` 가 있어도 **여기서 보지 않는다.** 실측 확인: 화면 어디에도 E 표기는
 *     원래 없었다(세션64 grep). 이 함수는 그것이 «다시 들어오지 못하게» 하는 자리이기도 하다.
 *
 * ⚠ 값은 `'951'` 처럼 숫자만 오므로 접두어를 붙여 `'INS 951'` 로 만든다.
 *   이미 'INS' 가 붙어 온 경우에는 두 번 붙이지 않는다.
 */
export function describeIns(row: Row): string | null {
  const raw = pickStr(row, ['ins_no'])
  if (!raw) return null
  return /^ins/i.test(raw) ? raw.replace(/^ins\s*/i, 'INS ') : `INS ${raw}`
}

/* ──────────────────────────────────────────────────────────────────────────
 * 4. 행 → 뷰 모델
 * ────────────────────────────────────────────────────────────────────────── */

/** 펼친 채로 둘 색. 초록·노랑은 접는다(개수는 항상 보인다). */
const ALERT_COLORS: AdditiveColor[] = ['red', 'orange', 'unknown']

/** 정렬 우선순위 — 위해 → 주의 → 등급 미상 → 허용 → 안전. */
const COLOR_RANK: Record<AdditiveColor, number> = {
  red: 0, orange: 1, unknown: 2, yellow: 3, green: 4,
}

export function toAdditiveView(row: Row, index: number): AdditiveView {
  // ⚠ `name` 은 `buildMfras` 모양(다른 엔드포인트)용 대비다. 이 엔드포인트의 정본은 `name_ko`.
  const name = pickStr(row, ['name_ko', 'name', 'name_kr', 'name_en']) || '이름 미상'
  const rawColorStr = pickStr(row, ['mfras_grade', 'color', 'risk_color', 'v1_risk_color'])
  const color = normalizeColor(rawColorStr)
  const fn = describeFunction(row)
  const id = str(row['additive_id']) || str(row['id'])

  return {
    key: id ? `a${id}` : `i${index}-${name}`,
    name,
    color,
    colorLabel: COLOR_LABEL[color],
    rawColor: rawColorStr || null,
    score: num(row['mfras_total']) ?? num(row['score']),
    functionText: fn.text,
    functionKnown: fn.known,
    functionSource: fn.source,
    ins: describeIns(row),
    iarc: describeIarc(row['iarc_group']),
    adi: describeAdi(row['adi_type'], row['adi_value']),
    alert: ALERT_COLORS.includes(color),
  }
}

/** `getAdditiveSummary()` 응답에서 필요한 부분만. 전체 타입에 묶이지 않는다(테스트 편의). */
export interface AdditiveSummaryLike {
  additives?: unknown
  risk_summary?: { total?: unknown } | null
}

/**
 * 응답 → 화면 뷰 모델.
 *
 * ★ 색별 개수를 서버 `risk_summary.by_color` 에서 가져오지 «않는다».
 *   그 집계는 4색만 세므로 4색 밖 첨가물이 어느 칸에도 안 잡힌다(productService.js:467~472).
 *   여기서 직접 세면 `counts.unknown` 이 남고, 「N종」과 pill 합계가 어긋나는 일이 사라진다.
 */
export function buildAdditiveList(summary: AdditiveSummaryLike | null | undefined): AdditiveListView {
  const rows: Row[] = Array.isArray(summary?.additives)
    ? (summary!.additives as unknown[]).filter((r): r is Row => !!r && typeof r === 'object')
    : []

  const items = rows.map(toAdditiveView)

  const counts: Record<AdditiveColor, number> = {
    green: 0, yellow: 0, orange: 0, red: 0, unknown: 0,
  }
  for (const it of items) counts[it.color] += 1

  const byRank = (a: AdditiveView, b: AdditiveView) =>
    COLOR_RANK[a.color] - COLOR_RANK[b.color] ||
    (b.score ?? -1) - (a.score ?? -1) ||
    a.name.localeCompare(b.name, 'ko')

  /**
   * ★ 등급 표시 OFF 동안의 정렬 — **이름 가나다순**.
   *   서버 순서는 `mfras_total DESC` 라 그대로 두면 위해성 판정이 «순서로» 새어 나간다.
   *   같은 이름이 두 번 나올 수 있으므로 key 로 안정화한다(정렬 결과가 흔들리면 안 된다).
   */
  const byName = (a: AdditiveView, b: AdditiveView) =>
    a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key)

  const serverTotal = num(summary?.risk_summary?.total)
  // ⚠ 서버 total 이 없거나 목록보다 «작으면» 목록 길이를 쓴다.
  //   화면의 「N종」이 실제로 그려지는 줄 수보다 적게 나오는 쪽이 더 나쁜 거짓말이다.
  const total = serverTotal !== null ? Math.max(serverTotal, items.length) : items.length

  return {
    total,
    items: [...items].sort(byName),
    alerts: items.filter((it) => it.alert).sort(byRank),
    calm: items.filter((it) => !it.alert).sort(byRank),
    counts,
    unlisted: Math.max(0, total - items.length),
  }
}
