import { visualizationHint } from "./visualization-policy";
import { buildSystemPrompt } from "./prompt";
import { callModel, type ModelMessage } from "./providers";
import { executeTool } from "./tools";
import type { ChartSpec } from "./chart-spec";
import { initialTools } from "./tool-selection";
import {
  chartFromEvidence,
  saveChart,
  type QueryEvidence,
} from "./chart-server";
import type { AgentContext } from "./context";

export type AgentEvent = {
  type: "step" | "tool";
  label: string;
  tool?: string;
  args?: Record<string, unknown>;
};
export async function runAgent(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  ctx: AgentContext,
  emit: (event: AgentEvent) => void = () => {},
  signal?: AbortSignal,
) {
  const evidence = new Map<string, QueryEvidence>();
  const charts: ChartSpec[] = [];
  const sources = new Set<string>();
  const thread: ModelMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
    ...messages.slice(-12),
  ];
  let model = "",
    provider = "",
    mutated = false;
  const request = messages.at(-1)?.content ?? "";
  const dataQuestion =
    /student|enrol|campus|trainer|course|class|fee|payment|donat|salary|placement|attendance|kitn|tadaad|talib/i.test(
      request,
    );
  let chartPrompted = false;
  const { allowed, definitions } = initialTools(request, ctx.role);
  for (let round = 0; round < 8; round++) {
    if (signal?.aborted) throw new Error("Request cancelled");
    emit({
      type: "step",
      label: round ? "Checking the evidence…" : "Understanding your question…",
    });
    let reply: Awaited<ReturnType<typeof callModel>>;
    try {
      reply = await callModel(thread, definitions, signal);
    } catch (error) {
      if (!charts.length && !mutated) throw error;
      return {
        content:
          "The AI service became unavailable before finishing its explanation. The charts below were successfully built from database queries. Any completed changes remain saved; do not repeat them without checking the records.",
        charts,
        model,
        provider,
        mutated,
        mode: "mock" as const,
      };
    }
    model = reply.model;
    provider = reply.provider;
    thread.push(reply.message);
    if (!reply.message.tool_calls?.length) {
      const clarifyingChart =
        /chart|graph|diagram/i.test(request) &&
        /\?/.test(reply.message.content ?? "");
      if (dataQuestion && sources.size === 0 && !clarifyingChart) {
        thread.push({
          role: "user",
          content:
            "No successful database or schema query has been made. Before answering this data question, call a suitable read tool. Do not infer that placements or salaries are tracked from tool names.",
        });
        continue;
      }
      if (
        !chartPrompted &&
        charts.length === 0 &&
        [...evidence.values()].some((e) => visualizationHint(e))
      ) {
        chartPrompted = true;
        thread.push({
          role: "system",
          content:
            "Before finalizing, assess whether the aggregate results would make this answer clearer as a visualization, regardless of the user's wording or language. If useful, call create_chart using the evidence and explain the finding. Do not ask permission for a helpful chart. Respect text-only preferences. If a chart adds no value or data is insufficient, finish with text; do not force a chart.",
        });
        continue;
      }
      const footer = sources.size
        ? `\n\n---\nSource: current database queries (${[...sources].join(", ")}).`
        : "";
      return {
        content: (reply.message.content || "No answer returned.") + footer,
        charts,
        model,
        provider,
        mutated,
        mode: "live" as const,
      };
    }
    // Sequence tools: later calls may depend on earlier reads or writes.
    for (const [index, call] of reply.message.tool_calls.entries()) {
      let result: unknown;
      try {
        if (index >= 8)
          throw new Error(
            "Too many tools in one round. Ask a narrower question.",
          );
        const args = JSON.parse(call.function.arguments || "{}");
        if (!args || Array.isArray(args) || typeof args !== "object")
          throw new Error("Arguments must be an object");
        const name = call.function.name;
        if (!definitions.some((t) => t.function.name === name))
          throw new Error("Unknown or unauthorized tool");
        emit({
          type: "tool",
          label:
            name === "create_chart"
              ? "Building an interactive chart…"
              : `Checking ${name.replace(/_/g, " ")}…`,
          tool: name,
          args,
        });
        if (name === "enable_tools") {
          if (!Array.isArray(args.names) || args.names.length > 5)
            throw new Error("Choose up to five tool names");
          for (const requested of args.names) {
            const tool = allowed.find((t) => t.function.name === requested);
            if (!tool) throw new Error("Tool not allowed");
            if (!definitions.some((t) => t.function.name === requested))
              definitions.push(tool);
          }
          result = { enabled: args.names };
        } else if (name === "create_chart") {
          if (charts.length >= 3)
            throw new Error(
              "Maximum three charts per answer; narrow your request.",
            );
          const chart = chartFromEvidence(args, evidence);
          await saveChart(
            chart,
            ctx.userId,
            ctx.role,
            evidence.get(args.result_id)!,
          );
          charts.push(chart);
          result = {
            success: true,
            chart_id: chart.id,
            title: chart.title,
            rows: chart.rows,
          };
        } else {
          result = JSON.parse(await executeTool(name, args, ctx));
          const failed =
            result && typeof result === "object" && "error" in result;
          if (
            !failed &&
            /^(get_|list_|analyze_|query_|describe_schema)/.test(name)
          ) {
            const id = `result_${evidence.size + 1}`;
            evidence.set(id, { tool: name, args, data: result });
            sources.add(name);
            const hint = visualizationHint({ tool: name, args, data: result });
            result = {
              result_id: id,
              data: result,
              ...(hint ? { visualization_hint: hint } : {}),
            };
          } else if (
            !failed &&
            /^(create_|update_|delete_|record_)/.test(name)
          ) {
            mutated =
              Boolean((result as { success?: boolean })?.success) || mutated;
          }
        }
      } catch (error) {
        result = {
          error: (error as Error).message,
          action:
            "Explain the limitation or correct the query; do not invent data.",
        };
      }
      const json = JSON.stringify(result);
      thread.push({
        role: "tool",
        tool_call_id: call.id,
        content:
          json.length > 18000
            ? JSON.stringify({
                error:
                  "Result too large for analysis. Narrow the query or use aggregation; do not count a partial list.",
              })
            : json,
      });
    }
  }
  return {
    content:
      "I reached the query limit before completing this analysis. Please narrow the metric, date range or campus. Any charts below contain only successfully queried data.",
    charts,
    model,
    provider,
    mutated,
    mode: "live" as const,
  };
}
