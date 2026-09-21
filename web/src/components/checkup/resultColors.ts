export function getResultLineColor(level: string): string {
  if (level === "normal") return "#10b981";
  if (level === "watch") return "#f59e0b";
  if (level === "low" || level === "high") return "#dc2626";
  return "#6b7280";
}
