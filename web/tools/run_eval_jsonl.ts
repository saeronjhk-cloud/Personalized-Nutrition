/**
 * 개인화 Eval 회귀 러너 v2 — 색 기반(먹선 traffic_light 소비).
 *
 * 원칙 4(Eval-First): 규칙 개정 전 이 러너로 회귀 기준을 실증한다.
 * IP 정본: 64_먹선개인화_Eval셋_v2.jsonl.
 *
 * 사용: npx tsx tools/run_eval_jsonl.ts <path-to-eval.jsonl>
 *   jsonl 각 줄: {"name","answers","trafficLight",["nutrition"],"expectApplicable","expectWarnKeys",["expectHasUnknown"]}
 *     trafficLight = {"nutrients":{"sodium":{"color":"red"}, ...}} 또는 null
 * 종료코드: 전부 통과 0, 실패 1.
 */
import { readFileSync } from 'node:fs'
import { personalizeProduct } from '../src/domain/meokseon/personalize'
import type { SurveyAnswers } from '../src/types'

const path = process.argv[2]
if (!path) { console.error('사용: npx tsx tools/run_eval_jsonl.ts <eval.jsonl>'); process.exit(2) }

const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim())
let pass = 0
const failures: string[] = []

for (const line of lines) {
  let c: any
  try { c = JSON.parse(line) } catch { failures.push(`파싱 실패: ${line.slice(0, 60)}`); continue }
  const r = personalizeProduct(c.nutrition ?? null, c.trafficLight ?? null, (c.answers ?? {}) as SurveyAnswers)
  const keys = r.warnings.map((w) => w.key).sort()
  const expectKeys = [...(c.expectWarnKeys ?? [])].sort()
  const okKeys = JSON.stringify(keys) === JSON.stringify(expectKeys)
  const okApp = r.applicable === c.expectApplicable
  const okUnknown = c.expectHasUnknown === undefined || r.hasUnknown === c.expectHasUnknown
  if (okKeys && okApp && okUnknown) pass++
  else failures.push(`${c.name ?? '(무명)'} → applicable=${r.applicable}(기대 ${c.expectApplicable}), warns=[${keys}](기대 [${expectKeys}]), hasUnknown=${r.hasUnknown}${c.expectHasUnknown !== undefined ? `(기대 ${c.expectHasUnknown})` : ''}`)
}

const total = lines.length
console.log(`EVAL ${pass}/${total} 통과`)
if (failures.length) { console.log('실패:'); for (const f of failures) console.log('  - ' + f) }
process.exit(failures.length ? 1 : 0)
