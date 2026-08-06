/**
 * 알레르기 표시 판정 — 순수 함수(렌더 비의존, 테스트 대상).
 *
 * ★ 이 파일의 존재 이유는 «무엇을 보여줄까»가 아니라 **«무엇을 단정하면 안 되는가»** 다.
 *
 *   먹선 서버는 세션44~51 여덟 세션에 걸쳐 알레르기 판정을 정교하게 다듬었다
 *   (3분리·근거 등급·이름 정규화·경계 가드). 그런데 2026-08-06 실측 결과
 *   **이 클라이언트는 `allergens` 계열 필드를 인터페이스에 갖고 있지도 않았다.**
 *   서버가 만든 경고가 사용자에게 도달하는 경로가 아예 없었다.
 *
 *   그래서 이제 붙이는데, 붙이면서 서버가 여덟 세션 동안 싸운 결함을
 *   화면에서 다시 만들면 안 된다. 특히 둘:
 *
 *   ① 「미수집」을 「알레르겐 없음」으로 말하지 않는다 (서버 세션46 치명1과 같은 축)
 *      수집 안 된 제품에 아무 표시도 안 하면 사용자는 «안전하다»고 읽는다.
 *      → `uncollected` 를 «명시적 상태»로 둔다. 카드를 숨기지 않는다.
 *
 *   ② 「혼입 가능」을 「직접 함유」와 같은 모양으로 쓰지 않는다 (서버 세션44)
 *      둘은 사용자 행동이 다르다. 같이 칠하면 과잉 경고가 되고,
 *      과잉 경고가 흔해지면 진짜 경고를 무시하게 된다(alarm fatigue).
 *
 * 서버 계약 (meokseon-server 세션48 `tests/test_allergen_contract.js`):
 *   allergens_available === false  → allergens · allergens_v2 가 둘 다 null (미수집)
 *   allergens_flat_complete === false → flat 이 전부가 아니다(혼입이 따로 있다)
 *   flat = contains + inferred. **혼입은 flat 에 들어가지 않는다.**
 */
import type { MsProductResult } from '../../lib/meokseon'

export type AllergenView =
  /** 수집되지 않았다. ⚠ 「없음」이 아니다 — 화면도 그렇게 말해야 한다. */
  | { kind: 'uncollected' }
  /** 3분리로 보여줄 수 있다. 세 배열 중 최소 하나는 비어 있지 않다. */
  | { kind: 'grouped'; contains: string[]; inferred: string[]; mayContain: string[] }
  /** 근거 구분이 없는 평탄 목록(사용자가 직접 덮어쓴 경우 등). 「직접 함유」로 단정하지 않는다. */
  | { kind: 'flat'; items: string[] }

function clean(x: unknown): string[] {
  if (!Array.isArray(x)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of x) {
    if (typeof v !== 'string') continue
    const s = v.trim()
    if (!s || seen.has(s)) continue
    seen.add(s); out.push(s)
  }
  return out
}

export function describeAllergens(result: Pick<
  MsProductResult, 'allergens' | 'allergens_v2' | 'allergens_available'
> | null | undefined): AllergenView {
  if (!result) return { kind: 'uncollected' }

  // ★ available 이 명시적으로 false 면 그 자체가 답이다. 목록을 더 볼 필요가 없다.
  if (result.allergens_available === false) return { kind: 'uncollected' }

  const v2 = result.allergens_v2
  const contains = clean(v2?.contains)
  const inferred = clean(v2?.inferred)
  const mayContain = clean(v2?.mayContain)

  if (contains.length || inferred.length || mayContain.length) {
    return { kind: 'grouped', contains, inferred, mayContain }
  }

  const flat = clean(result.allergens)
  if (flat.length) return { kind: 'flat', items: flat }

  // ⚠ 여기까지 왔다 = available 이 true(또는 미상)인데 목록이 비었다.
  //   서버 계약상 「확인했고 알레르겐 없음」이라는 상태는 **아직 존재하지 않는다**
  //   (meokseon-server 세션48 §6 PENDING). 그러므로 「없음」이라고 말할 근거가 없다.
  //   근거 없이 안심시키는 것보다 「모른다」가 안전하다.
  return { kind: 'uncollected' }
}

/* ★ 카드는 «항상» 띄운다. 세 상태 전부 사용자가 알아야 할 정보이고,
 *   특히 `uncollected` 에서 카드를 숨기면 «침묵»이 「알레르겐 없음」으로 읽힌다.
 *   그래서 shouldShow 류의 분기를 일부러 두지 않았다. */
