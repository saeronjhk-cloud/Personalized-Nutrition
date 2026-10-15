/**
 * 검진 그림 PDF 글자 인식 IO — 쪽 이미지 렌더(pdfjs) → Edge POST /functions/v1/checkup-ocr → 단어 상자
 * 값 해석은 하지 않는다(checkupOcr.ts → parseCheckupText 가 한다). 이미지·글자는 어디에도 저장하지 않는다.
 * 설계 IP/integration/checkup_ocr_v1/00_설계·평가셋_v1.md · 플래그 CHECKUP_OCR_ENABLED(기본 OFF)
 */
import { supabase } from "./supabase";
import type { OcrWord } from "./checkupOcr";

const BASE = import.meta.env.VITE_SUPABASE_URL || "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const ENDPOINT = `${BASE}/functions/v1/checkup-ocr`;

/** 한 번에 읽는 최대 쪽 수 — 결과지 한 부는 보통 10쪽 안팎 */
export const OCR_MAX_PAGES = 15;
/** 렌더 폭(px) — 평가(10-15)는 200dpi A4 ≈ 1650px 에서 13항목 중 12 일치·오값 0 */
export const OCR_RENDER_WIDTH = 1650;
const CONCURRENCY = 3;

export const OCR_NOTICE =
  "글자 인식을 위해 이 PDF의 각 쪽을 이미지로 바꿔 Google(미국)의 글자 인식 서비스로 보냅니다. 인식이 끝나면 이미지와 글자는 저장하지 않습니다. 불러온 값은 저장하기 전에 꼭 확인해 주세요.";
export const OCR_FAIL_MSG = "글자 인식에 실패했어요. 잠시 후 다시 시도하시거나 아래에 직접 입력해 주세요.";

export class OcrError extends Error {}

/** PDF → 쪽마다 JPEG(base64, 머리 없이) */
export async function renderPdfPagesToJpeg(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  if (doc.numPages > OCR_MAX_PAGES) throw new OcrError(`쪽 수가 너무 많아요(최대 ${OCR_MAX_PAGES}쪽).`);
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: OCR_RENDER_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new OcrError("이미지를 만들 수 없어요.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    out.push(canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "");
    canvas.width = 0;
    canvas.height = 0;
  }
  return out;
}

async function ocrOne(image: string, token: string): Promise<OcrWord[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok || !Array.isArray(json.words)) throw new OcrError(OCR_FAIL_MSG);
  return json.words as OcrWord[];
}

/** 쪽 이미지들 → 쪽별 단어 상자(순서 유지, 동시 3건) */
export async function ocrPages(images: string[]): Promise<OcrWord[][]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new OcrError("로그인이 필요합니다");
  const out: OcrWord[][] = new Array(images.length);
  let next = 0;
  const worker = async () => {
    while (next < images.length) {
      const i = next++;
      out[i] = await ocrOne(images[i], token);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, images.length) }, worker));
  return out;
}
