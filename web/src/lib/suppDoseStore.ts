/** 합계 점검 v0 — 라벨 함량 입력 기기 안 저장(서버 전송 0). 실패해도 빈 입력으로 동작. */
import { parseDoseStore, type DoseStore } from "../domain/supplement/ul_dose";

const KEY = "nf_supp_dose_v1";

export function loadDoseStore(): DoseStore {
  try { return parseDoseStore(localStorage.getItem(KEY)); } catch { return {}; }
}
export function saveDoseStore(s: DoseStore): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 실패는 무시 */ }
}
