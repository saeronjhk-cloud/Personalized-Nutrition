/** 검진 OCR 연결 가드 — 평가셋 IP/integration/checkup_ocr_v1/00_설계·평가셋_v1.md §4 OW1~OW5 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHECKUP_OCR_ENABLED } from "../../../lib/flags";
import { OCR_NOTICE } from "../../../lib/checkupOcrClient";

const src = readFileSync(resolve(__dirname, "../BiomarkerForm.tsx"), "utf-8");
const edge = readFileSync(resolve(__dirname, "../../../../supabase/functions/checkup-ocr/index.ts"), "utf-8");
const fn = (name: string) => {
  const i = src.indexOf(`function ${name}`);
  return src.slice(i, src.indexOf("\n  }\n", i));
};

describe("OW 검진 OCR 연결", () => {
  it("OW1 기본 OFF(VITE_CHECKUP_OCR 미설정)", () => expect(CHECKUP_OCR_ENABLED).toBe(false));
  it("OW2 그림 PDF 판정 뒤 플래그가 켜졌을 때만 제안, 꺼지면 기존 안내 그대로", () => {
    const h = fn("handleImportPdf");
    expect(h).toMatch(/isImageOnlyPdfText\(text\)\)\s*\{\s*if \(CHECKUP_OCR_ENABLED\)\s*\{\s*setOcrOffer\(file\)/);
    expect(h).toContain("결과가 그림으로 저장돼 있어 글자를 읽을 수 없어요");
  });
  it("OW3 전송은 사용자가 고지를 보고 «글자 인식으로 불러오기»를 누를 때만 — 고지에 국외(미국)·저장 안 함·확인 요청", () => {
    expect(src).toContain("onClick={handleOcrImport}");
    expect(fn("handleImportPdf")).not.toContain("ocrPages(");
    for (const k of ["Google(미국)", "저장하지 않습니다", "확인해 주세요"]) expect(OCR_NOTICE).toContain(k);
  });
  it("OW4 OCR 결과도 같은 파서(applyParsedText)로만 채우고 자동 저장 0", () => {
    const h = fn("handleOcrImport");
    expect(h).toContain("applyParsedText(ocrPagesToCheckupText(pages)");
    expect(h).not.toMatch(/save|insert|upsert|handleSubmit/i);
  });
  it("OW5 Edge: 인증 확인 · 저장 0(스토리지·DB 쓰기 없음) · 로그에 내용 없음", () => {
    expect(edge).toContain("auth.getUser()");
    expect(edge).not.toMatch(/\.from\(|storage|\.insert\(|\.upload\(/);
    expect(edge).not.toMatch(/console\.(log|warn)\([^)]*(image|words\b(?!\.length)|text)/);
  });
});
