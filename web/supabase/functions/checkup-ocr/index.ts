// checkup-ocr — 검진 결과지 쪽 이미지 1장 → Google Vision DOCUMENT_TEXT_DETECTION → 단어 상자만 돌려준다.
// ⛔ 저장 0: 이미지·글자를 DB/스토리지/로그에 남기지 않는다(로그는 상태 코드·단어 수만).
// 인증: verify_jwt(기본) + 아래 getUser 로 한 번 더. secret: GOOGLE_VISION_API_KEY
// 설계 IP/integration/checkup_ocr_v1/00_설계·평가셋_v1.md · 웹 플래그 CHECKUP_OCR_ENABLED(기본 OFF)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_B64 = 6_000_000; // 쪽 이미지 1장 약 4.5MB 까지
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Word = { t: string; x0: number; x1: number; y0: number; y1: number; p: number[] };

function toWords(resp: any): Word[] {
  const out: Word[] = [];
  for (const pg of resp?.fullTextAnnotation?.pages ?? [])
    for (const b of pg.blocks ?? [])
      for (const p of b.paragraphs ?? [])
        for (const w of p.words ?? []) {
          const v = w.boundingBox?.vertices ?? [];
          const xs = v.map((q: any) => q.x ?? 0);
          const ys = v.map((q: any) => q.y ?? 0);
          const t = (w.symbols ?? []).map((s: any) => s.text ?? "").join("");
          if (!t || xs.length === 0) continue;
          // p = 꼭짓점 4개(사진 기울기 바로잡기용, 웹 lib/checkupOcr.ts deskew)
          const p = v.length === 4 ? v.flatMap((q: any) => [q.x ?? 0, q.y ?? 0]) : [];
          out.push({ t, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), p });
        }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: { code: "METHOD" } });

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return json(401, { ok: false, error: { code: "AUTH" } });

  const key = Deno.env.get("GOOGLE_VISION_API_KEY");
  if (!key) return json(503, { ok: false, error: { code: "NOT_CONFIGURED" } });

  let image = "";
  try {
    image = String((await req.json())?.image ?? "");
  } catch {
    return json(400, { ok: false, error: { code: "BODY" } });
  }
  if (!image || image.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200)))
    return json(400, { ok: false, error: { code: "IMAGE" } });

  const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: image }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["ko", "en"] } }],
    }),
  });
  image = "";
  if (!r.ok) {
    console.warn("checkup-ocr vision", r.status);
    return json(502, { ok: false, error: { code: "VISION" } });
  }
  const data = await r.json();
  const words = toWords(data?.responses?.[0]);
  console.log("checkup-ocr ok", words.length);
  return json(200, { ok: true, words });
});
