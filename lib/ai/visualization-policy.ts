import type { QueryEvidence } from "./chart-server";

/** Suggestions use aggregate shapes, never arbitrary numeric record fields. */
export function visualizationHint(evidence: QueryEvidence) {
  if (
    !evidence.args.group_by ||
    !/^(analyze_|query_collection$)/.test(evidence.tool)
  )
    return null;
  const data = evidence.data as { rows?: Record<string, unknown>[] } | null;
  const rows = data?.rows;
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 100) return null;
  const keys = Object.keys(rows[0]);
  const labels = keys.filter(
    (key) =>
      rows.every((row) => typeof row[key] === "string") &&
      new Set(rows.map((row) => row[key])).size === rows.length,
  );
  const metrics = keys.filter(
    (key) =>
      !/(^id$|_id$|year|month)/i.test(key) &&
      rows.every(
        (row) => typeof row[key] === "number" && Number.isFinite(row[key]),
      ),
  );
  if (!labels.length || !metrics.length) return null;
  const time = labels.find((key) =>
    rows.every((row) => /^\d{4}-\d{2}(?:-\d{2})?$/.test(String(row[key]))),
  );
  return {
    label_fields: labels,
    value_fields: metrics,
    suggested_type: time ? "line" : "bar",
    reason: time
      ? "Multiple dated observations: a trend chart can reveal changes over time."
      : "Multiple aggregate categories: a comparison chart can make differences easier to understand.",
    instruction:
      "Decide whether this result helps explain the user's question visually, even if they never asked for a chart. If useful, call create_chart now using this result_id and actual fields, then explain the main finding. Skip irrelevant aggregates, insufficient coverage, text-only requests and visuals that would mislead. Use pie only for a few mutually exclusive parts of a known total; use area for volume over time.",
  };
}
