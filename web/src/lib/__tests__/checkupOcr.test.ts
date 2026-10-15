/**
 * 검진 그림 PDF 글자 인식 v1 — 평가셋 IP/integration/checkup_ocr_v1/00_설계·평가셋_v1.md §4 (O01~O14)
 * 합성 표본(가짜 값). 서식은 병원 결과 화면 인쇄본(검사항목 | 단위 | 참고치 | 최근 날짜 | 지난 날짜 | 잘린 날짜)을 본뜸.
 * 실제 표본(제이 결과지) 결과는 평가 문서 §5 에 일치/불일치만 기록(건강정보 원문은 저장소 밖).
 */
import { describe, it, expect } from "vitest";
import { ocrPageToLines, ocrPagesToCheckupText, groupRows, joinWords, type OcrWord } from "../checkupOcr";
import { parseCheckupText } from "../checkupImport";

// 열 위치(px, 200dpi 렌더 기준과 비슷하게)
const X = { label: 290, unit: 620, ref: 760, d1: 990, d2: 1240, d3: 1480 };
let y = 100;
const w = (t: string, x0: number, yy: number, wd = t.length * 18): OcrWord => ({ t, x0, x1: x0 + wd, y0: yy, y1: yy + 22 });
/** 한 줄: 라벨 낱말들(붙여서) + 나머지 칸 */
function row(label: string[], cells: Partial<Record<"unit" | "ref" | "d1" | "d2" | "d3", string[]>>): OcrWord[] {
  y += 50;
  const out: OcrWord[] = [];
  let x = X.label;
  for (const t of label) { out.push(w(t, x, y)); x += t.length * 18 + 4; }
  for (const [k, ts] of Object.entries(cells)) {
    let cx = X[k as keyof typeof X];
    for (const t of ts ?? []) { out.push(w(t, cx, y)); cx += t.length * 18 + 4; }
  }
  return out;
}
const header = (d1 = "2026-08-06", d2 = "2025-08-07", d3 = "2023-") =>
  row(["검사항목"], { ref: ["참고치"], d1: [d1], d2: [d2], d3: [d3] });
const parse = (pages: OcrWord[][]) => parseCheckupText(ocrPagesToCheckupText(pages));
const val = (pages: OcrWord[][], key: string) => parse(pages).items.find((i) => i.label === key)?.value;

describe("O01~O04 줄 묶기·이번 결과 열", () => {
  it("O01 같은 높이 상자 = 한 줄, 왼→오", () => {
    const rs = groupRows([w("B", 300, 100), w("A", 100, 102), w("C", 100, 160)]);
    expect(rs.map((r) => joinWords(r.w))).toEqual(["A B", "C"]);
  });
  it("O02 이번 결과 = 가장 최근 날짜 열(참고치·지난 결과 버림)", () => {
    y = 100;
    const p = [...header(), ...row(["공복시", "혈당"], { unit: ["mg/", "dL"], ref: ["<100"], d1: ["115"], d2: ["98"], d3: ["10"] })];
    expect(val([p], "fasting_glucose")).toBe(115);
  });
  it("O03 날짜 열 순서가 과거→현재여도 최근 날짜 열", () => {
    y = 100;
    const p = [...header("2024-08-01", "2026-08-06", "2025-"), ...row(["공복시", "혈당"], { ref: ["<100"], d1: ["90"], d2: ["115"] })];
    expect(val([p], "fasting_glucose")).toBe(115);
  });
  it("O04 검진일 = 최근 날짜 머리글", () => {
    y = 100;
    expect(parse([[...header(), ...row(["AST(GOT)"], { ref: ["≤40"], d1: ["29"] })]]).date).toBe("2026-08-06");
  });
});

describe("O05~O09 오값 방지(R02)", () => {
  it("O05 «당화혈색소» 줄에서 혈색소(Hb)를 잡지 않는다 · 혈색소는 제 줄에서", () => {
    y = 100;
    const p = [...header(), ...row(["당화혈색소"], { unit: ["%"], ref: ["<5.7"], d1: ["6.0"] }), ...row(["혈색소(Hb)"], { unit: ["g/", "dL"], ref: ["13-17"], d1: ["16.2"] })];
    expect(val([p], "hba1c")).toBe(6);
    expect(val([p], "hemoglobin")).toBe(16.2);
  });
  it("O05b 글자 PDF 한 줄 «당화혈색소 6.0» 에서도 혈색소 없음", () => {
    expect(parseCheckupText("당화혈색소 6.0 %").items.map((i) => i.label)).toEqual(["hba1c"]);
  });
  it("O06 참고치 기호 오독(«<200» → «(200», «≥60» → «260») 은 열 위치로 무시", () => {
    y = 100;
    const p = [...header(), ...row(["총콜레스테롤"], { ref: ["(200"], d1: ["261"] }), ...row(["사구체", "여과율(eGFR)"], { ref: ["260"], d1: ["85"] })];
    expect(val([p], "total_cholesterol")).toBe(261);
    expect(val([p], "egfr")).toBe(85);
  });
  it("O07 γ-GTP 오독 «T-GTP» 도 감마지티피", () => {
    y = 100;
    expect(val([[...header(), ...row(["T-GTP"], { unit: ["IU/", "L"], ref: ["(60"], d1: ["41"], d3: ["5060"] })]], "gamma_gtp")).toBe(41);
  });
  it("O08 설명 문단 속 숫자(«공복혈당 126 mg/dL 이상이거나…»)는 값이 아니다", () => {
    y = 100;
    const p = [...header(), ...row(["당뇨병의", "기준은", "공복혈당", "126"], { d1: ["이상이거나"], d2: ["당화혈색소"] })];
    expect(parse([p]).items).toEqual([]);
  });
  it("O09 결과 칸이 비면(OCR 이 «–» 를 놓침) 빈칸 — 추측 0", () => {
    y = 100;
    const p = [...row(["소변", "검사"], {}), ...header(), ...row(["단백"], { ref: ["-"] })];
    expect(val([p], "urine_protein")).toBeUndefined();
  });
});

describe("O10~O14 서식 변형", () => {
  it("O10 소변 검사 구역의 «단백» = 요단백(+1 → 1) · 간기능 «총단백» 은 아님", () => {
    y = 100;
    const p = [
      ...row(["간기능", "검사"], {}), ...header(), ...row(["총단백"], { unit: ["g/", "dL"], ref: ["6.0-8.0"], d1: ["7.3"] }),
      ...row(["소변", "검사"], {}), ...header(), ...row(["단백"], { ref: ["-"], d1: ["+1"] }),
    ];
    expect(val([p], "urine_protein")).toBe(1);
  });
  it("O11 표가 다음 쪽으로 이어지면(머리글 없음) 앞 쪽 열 위치를 쓴다", () => {
    y = 100;
    const p1 = [...header(), ...row(["AST(GOT)"], { ref: ["≤40"], d1: ["29"] })];
    y = 100;
    const p2 = [...row(["ALT(GPT)"], { ref: ["≤40"], d1: ["34"], d2: ["40"] })];
    expect(val([p1, p2], "alt")).toBe(34);
  });
  it("O12 날짜 머리글 없는 쪽(공단 결과통보서식 «항목 값 단위» 한 줄) — 짧은 줄은 그대로 파서로", () => {
    y = 100;
    const p = [...row(["공복혈당", "95", "mg/dL"], {}), ...row(["검진일", "2025.11.03"], {})];
    const r = parse([p]);
    expect(r.items.find((i) => i.label === "fasting_glucose")?.value).toBe(95);
    expect(r.date).toBe("2025-11-03");
  });
  it("O13 날짜 머리글 없는 쪽의 문장 줄은 버린다", () => {
    y = 100;
    expect(parse([row(["공복혈당이", "100-125", "mg/dL인", "경우에는", "전단계입니다."], {})]).items).toEqual([]);
  });
  it("O14 단위가 결과 뒤로 옮겨져 환산 판단에 쓰인다(mmol/L 표기 → mg/dL 환산)", () => {
    y = 100;
    const p = [...header(), ...row(["공복시", "혈당"], { unit: ["mmol/", "L"], ref: ["<5.6"], d1: ["6.4"] })];
    const it = parse([p]).items.find((i) => i.label === "fasting_glucose");
    expect(it?.raw).toContain("6.4 mmol/L");
    expect(it?.value).toBeGreaterThan(100);
  });
});
