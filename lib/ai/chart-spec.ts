import { z } from "zod";

export const chartTypes = [
  "bar",
  "line",
  "area",
  "pie",
  "table",
  "flow",
] as const;
export const chartSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i),
  title: z.string().min(1).max(120),
  type: z.enum(chartTypes),
  label: z.string().min(1).max(100),
  metric: z.string().min(1).max(100),
  rows: z
    .array(z.object({ label: z.string().max(200), value: z.number().finite() }))
    .min(1)
    .max(100),
  source: z.string().max(100),
  generatedAt: z.string().datetime(),
  note: z.string().max(500),
});
export type ChartSpec = z.infer<typeof chartSchema>;
export const chartRequestSchema = z.object({
  result_id: z.string(),
  title: z.string().min(1).max(120),
  type: z.enum(chartTypes),
  label_field: z.string().min(1).max(100),
  value_field: z.string().min(1).max(100),
});
export const chartTool = {
  type: "function" as const,
  function: {
    name: "create_chart",
    description:
      "Create an interactive chart from a fresh read result_id returned this turn. Choose existing string label_field and numeric value_field in its rows. Data values are copied by the server, never supplied by the model. No image or markdown needed.",
    parameters: {
      type: "object",
      properties: {
        result_id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: chartTypes },
        label_field: { type: "string" },
        value_field: { type: "string" },
      },
      required: ["result_id", "title", "type", "label_field", "value_field"],
      additionalProperties: false,
    },
  },
};
