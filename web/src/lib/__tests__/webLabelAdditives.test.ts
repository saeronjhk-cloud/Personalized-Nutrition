// ★ 세션79 E9 — 판매처 품목 첨가물 조회 경로(정답 backends/먹선/IP/eval_web_label_additives_v1)
import { describe, it, expect, vi, afterEach } from 'vitest'
const API = 'https://api.example.test'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })
describe('getWebLabelAdditiveSummary', () => {
  it('GET /api/products/web/:id/additives · data 를 그대로 돌려준다 · 404 는 MeokseonNotFound', async () => {
    vi.stubEnv('VITE_MEOKSEON_API_URL', API)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { product_id: 7, product_name: 'x', additives: [], risk_summary: { total: 0 }, derived_additives: { source: 'own', items: [{ name: '변성전분' }] } } }) })
    vi.stubGlobal('fetch', fetchMock)
    const m = await import('../meokseon')
    const r = await m.getWebLabelAdditiveSummary(307205)
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API}/api/products/web/307205/additives`)
    expect((r as any).derived_additives.items[0].name).toBe('변성전분')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    await expect(m.getWebLabelAdditiveSummary(1)).rejects.toBeInstanceOf(m.MeokseonNotFound)
  })
})
