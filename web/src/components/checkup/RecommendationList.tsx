import { useMemo } from "react";
import type { CategoryResult } from "../../domain/checkup/engine";
import CategoryCard from "./CategoryCard";

interface Props {
  results: CategoryResult[];
}

function isManagementRecommended(result: CategoryResult): boolean {
  if (result.level === "unknown" || result.level === "normal") return false;
  return true;
}

function groupByFunctionalNeeds(results: CategoryResult[]): {
  groups: [string, CategoryResult[]][];
  unknown: CategoryResult[];
} {
  const unknown = results.filter((result) => result.level === "unknown");
  const known = results.filter((result) => result.level !== "unknown");
  const map = new Map<string, CategoryResult[]>();

  for (const result of known) {
    const needs = result.functional_needs.length > 0 ? result.functional_needs : ["기타"];
    for (const need of needs) {
      const list = map.get(need) ?? [];
      if (!list.some((item) => item.biomarker_key === result.biomarker_key)) {
        list.push(result);
      }
      map.set(need, list);
    }
  }

  const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "ko"));
  return { groups, unknown };
}

export default function RecommendationList({ results }: Props) {
  const { groups, unknown } = useMemo(() => groupByFunctionalNeeds(results), [results]);

  const managementCount = useMemo(
    () => results.filter(isManagementRecommended).length,
    [results],
  );

  if (results.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
        분석 결과가 없습니다. 검진 수치를 입력한 뒤 분석하기를 눌러 주세요.
      </p>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        전체 {results.length}개 분석, 관리 권장 {managementCount}개
      </p>

      {groups.map(([categoryName, categoryResults]) => (
        <CategoryCard key={categoryName} categoryName={categoryName} results={categoryResults} />
      ))}

      {unknown.length > 0 && (
        <CategoryCard categoryName="입력 부족" results={unknown} />
      )}
    </section>
  );
}
