import { ObjectId } from "mongodb";
import { mongo } from "../mongodb";
import { chartRequestSchema, chartSchema, type ChartSpec } from "./chart-spec";

export type QueryEvidence = {
  tool: string;
  args: Record<string, unknown>;
  data: unknown;
};

export function chartFromEvidence(
  args: unknown,
  evidence: Map<string, QueryEvidence>,
): ChartSpec {
  const spec = chartRequestSchema.parse(args);
  const result = evidence.get(spec.result_id);
  if (!result)
    throw new Error(
      "Query data first: result_id must reference a successful read from this turn.",
    );
  const data = result.data as Record<string, unknown>;
  const raw = Array.isArray(data) ? data : data.rows;
  if (!Array.isArray(raw) || !raw.length)
    throw new Error(
      "This query has no chartable rows. Ask for a grouped metric.",
    );
  if (raw.length > 100)
    throw new Error(
      "Too many categories. Narrow the query or group by a broader dimension.",
    );
  const rows = raw.map((row: Record<string, unknown>) => {
    const label = row[spec.label_field],
      value = row[spec.value_field];
    if (
      (typeof label !== "string" && typeof label !== "number") ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      throw new Error(
        "Choose an existing label field and a numeric measure. Missing values cannot be invented or converted to zero.",
      );
    }
    return { label: String(label), value };
  });
  if (new Set(rows.map((row) => row.label)).size !== rows.length)
    throw new Error(
      "Duplicate labels: query a single grouping dimension or select a unique label.",
    );
  if (
    spec.type === "pie" &&
    (rows.length > 8 ||
      rows.some((row) => row.value < 0) ||
      rows.every((row) => row.value === 0))
  )
    throw new Error(
      "Pie charts require 1–8 nonnegative categories and a positive total; use bar or table instead.",
    );
  if (spec.type === "line" || spec.type === "area") {
    const asDate=(label:string)=>Date.parse(/^\d{4}-\d{2}$/.test(label)?label+"-01":label);
    if(rows.every(row=>Number.isFinite(asDate(row.label))))rows.sort((a,b)=>asDate(a.label)-asDate(b.label));
  }
  const scope =
    !Array.isArray(data) && data.filters
      ? ` Filters: ${JSON.stringify(data.filters)}.`
      : "";
  return chartSchema.parse({
    id: new ObjectId().toHexString(),
    title: spec.title,
    type: spec.type,
    label: spec.label_field,
    metric: spec.value_field,
    rows,
    source: result.tool,
    generatedAt: new Date().toISOString(),
    note: (
      "Snapshot of returned query rows; query limits apply. Ask for a new chart to refresh." +
      scope
    ).slice(0, 500),
  });
}

export async function saveChart(
  chart: ChartSpec,
  ownerId: string,
  role: string,
  evidence: QueryEvidence,
) {
  const db = await mongo();
  await db
    .collection("portal_ai_charts")
    .insertOne({
      _id: new ObjectId(chart.id),
      ownerId,
      role,
      chart,
      query: { tool: evidence.tool, args: evidence.args },
      createdAt: new Date(),
    });
}
