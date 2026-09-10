import { toolDefinitions } from "./tools";
import { chartTool } from "./chart-spec";

export function initialTools(question: string, role: string) {
  const allowed = toolDefinitions.filter((t) => {
    if(t.function.name==="list_placed_students")return false;
    if (/^(create_|update_|delete_|record_)/.test(t.function.name))
      return (
        role === "admin" &&
        /\b(create|add|enrol|enroll|update|edit|delete|remove)\b.*\b(student|campus|trainer|course|class|record)\b/i.test(
          question,
        )
      );
    if (t.function.name === "generate_word_report")
      return /\b(word|document|docx|export)\b/i.test(question);
    return true;
  });
  const names = new Set([
    "get_org_stats",
    "describe_schema",
    "query_collection",
    "analyze_enrolments",
  ]);
  if (/fee|payment|invoice|paisa|fees/i.test(question))
    names.add("analyze_fee_payments");
  if (/donat|campaign|fundrais|chanda/i.test(question))
    names.add("analyze_donations");
  if (/attendan|hazri|haazri/i.test(question)) names.add("analyze_attendance");
  if (/list|dikhao|show|campus|campuses/i.test(question))
    names.add("list_campuses");
  const discover = {
    type: "function" as const,
    function: {
      name: "enable_tools",
      description:
        "Enable additional specialized tools for the next step (students, trainers, classes, fees, attendance, academic records or authorized edits).",
      parameters: {
        type: "object",
        properties: {
          names: {
            type: "array",
            items: {
              type: "string",
              enum: allowed.map((t) => t.function.name),
            },
            maxItems: 5,
          },
        },
        required: ["names"],
      },
    },
  };
  return {
    allowed,
    definitions: [
      ...allowed.filter((t) => names.has(t.function.name)),
      chartTool,
      discover,
    ],
  };
}
