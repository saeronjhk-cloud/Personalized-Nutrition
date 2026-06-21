import type { CategoryResult } from "../../domain/checkup/engine";
import { resolveToneBody } from "../../domain/checkup/compliance";
import { getResultLineColor } from "./resultColors";

const LEVEL_SEVERITY: Record<string, number> = {
  normal: 1,
  watch: 2,
  low: 3,
  high: 3,
  unknown: 0,
};

const TONE_SEVERITY: Record<string, number> = {
  유지: 1,
  관리권장: 2,
  전문가상담권장: 3,
};

function levelAccentColor(level: string): string {
  return getResultLineColor(level);
}

function pickMostSevereLevel(results: CategoryResult[]): string {
  let maxSeverity = -1;
  let picked = "unknown";
  for (const result of results) {
    const severity = LEVEL_SEVERITY[result.level] ?? 0;
    if (severity > maxSeverity) {
      maxSeverity = severity;
      picked = result.level;
    }
  }
  return picked;
}

function pickMostSevereTone(results: CategoryResult[]): string | null {
  let maxSeverity = -1;
  let picked: string | null = null;
  for (const result of results) {
    if (!result.tone) continue;
    const severity = TONE_SEVERITY[result.tone] ?? 0;
    if (severity > maxSeverity) {
      maxSeverity = severity;
      picked = result.tone;
    }
  }
  return picked;
}

function formatTitle(categoryName: string): string {
  if (categoryName === "입력 부족") return categoryName;
  return categoryName.endsWith("관심") ? categoryName : `${categoryName} 관심`;
}

interface Props {
  categoryName: string;
  results: CategoryResult[];
}

export default function CategoryCard({ categoryName, results }: Props) {
  const accentLevel = pickMostSevereLevel(results);
  const accentColor = levelAccentColor(accentLevel);
  const tone = pickMostSevereTone(results);
  const toneBody = resolveToneBody(tone);
  const hasMedicalReferral = results.some((result) => result.force_medical_referral);

  return (
    <article
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <header
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          borderLeft: `4px solid ${accentColor}`,
        }}
      >
        <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: accentColor }}>
          {formatTitle(categoryName)}
        </h4>
      </header>

      <section style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {results.map((result) => (
            <li
              key={result.biomarker_key}
              style={{
                fontSize: 14,
                color: result.force_medical_referral ? "#ef4444" : getResultLineColor(result.level),
                lineHeight: 1.5,
              }}
            >
              <strong>{result.biomarker_key}</strong>
              {" — "}
              {result.value}
              {" — "}
              {result.label_ko ?? "범위 미매칭"}
            </li>
          ))}
        </ul>
      </section>

      {toneBody && (
        <section style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {toneBody}
          </p>
        </section>
      )}

      <footer style={{ padding: "16px 20px" }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          본 정보는 의학적 진단·치료를 대체하지 않습니다. 질환·약물 복용 중이면 전문가 상담을 권장합니다.
        </p>
        {hasMedicalReferral && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13,
              fontWeight: 600,
              color: "#dc2626",
              lineHeight: 1.5,
            }}
          >
            검진 결과에 따라 전문가 상담이 필요합니다
          </p>
        )}
      </footer>
    </article>
  );
}
