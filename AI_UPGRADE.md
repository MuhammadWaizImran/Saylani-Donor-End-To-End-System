# AI and dashboard charts

## Current setup

MongoDB is configured in the ignored `.env.local`. The supplied Atlas SRV address failed through local Node DNS; the equivalent Atlas host list is configured with TLS, replica-set discovery, and the original database. Credentials are server-side only. The connection retries after an initial failure instead of permanently caching a rejected promise.

The database checks found 102 student profiles, 114 enrolments, 7 campuses, 9 trainers, 107 fee-payment records, and 0 donation records. These are observations at test time, not constants used by the application.

Primary: **Groq `openai/gpt-oss-120b`**. Fallback: **Gemini 3.6 Flash**, with the two supplied Groq keys available for credential failover. The latency update below supersedes the initial model ordering. Change `GEMINI_MODEL` or `GROQ_MODEL` in `.env.local` to switch models.

The choice is based on this project's small live evaluation, not a claim that one model is universally best. Gemini 3.1 Pro Preview was rejected with a zero free-tier quota. Gemini 3.8 Flash answered a campus query, but its 20-request daily free allowance was exhausted during testing. Gemini 3.6 Flash completed the comparison, missing-data and clarification cases. Provider quota/billing changes remain external to this application.

## Evaluation findings

| Case | Gemini 3.6 Flash | Groq GPT-OSS 120B |
| --- | --- | --- |
| Unique profiles vs enrolments | Correct: 102 vs 114 | Initial evaluation hit HTTP 413; smaller request subsequently called the correct totals tool |
| Enrolments by campus | Correct live grouped counts | Correct live grouped counts; faster in this sample |
| Average graduate salary | Explained that verified outcome/salary data is unavailable and identified required data | Incorrectly assumed placement records existed without querying; this is a failed grounding case |
| Vague Roman Urdu chart request | Asked metric, grouping/time and chart-type preferences | Asked for preferences, but replied in English |

The failed Groq case prompted additional server checks: data questions require a successful data/schema query before accepting a factual answer, and the misleading legacy placement-list tool is not exposed. These controls improve grounding but are not a guarantee against every model error. The broad comparison results precede those final guard changes; do not treat them as a complete post-change accuracy benchmark.

`model-evaluation.json` contains the comparison outputs and timings. `model-evaluation-initial.json` records earlier quota failures. `live-agent-evaluation.json` records the end-to-end chart check. Test artifacts in MongoDB use dedicated temporary owners and are removed after checks; business records are not modified by these tests.

## What changed

- Shorter evidence-focused prompt: plain language, accurate record definitions, useful limitations, and required missing data. Broad analysis no longer forces a Word-document confirmation before answering.
- On-demand tool discovery reduces the tool context sent on routine questions. Calls execute in order; Gemini tool-call thought signatures survive subsequent rounds.
- Provider calls have timeouts, bounded transient-error retries, key/provider failover, and sanitized errors. API messages have runtime role/content validation.
- Schema inspection includes sampled live field types, current counts and observed status values instead of assuming old approximate counts remain valid. Generic queries support exact `count_only`, validate fields and scalar filters, and deny private system collections. Unscopeable trainer queries are refused.
- Enrolment analysis supports inclusive start/end dates, rejects invalid dates, excludes missing dates when filtering, and reports the true matching count separately from returned groups.
- Charts are typed data objects made from successful query results in the current turn. The model selects fields and chart type; the server supplies every plotted number. Unknown results, invented metrics, duplicate category labels and unsuitable pie data are rejected.
- Chat charts persist in conversation history. The new `portal_ai_charts` and `portal_chart_boards` collections store artifacts and owner-specific dashboard layouts. APIs check chart ownership and use optimistic concurrency for layout updates.
- The admin overview now labels its enrolment total as enrolments rather than unique students.

## Using charts

1. Open **Ask AI** on the admin/trainer main dashboard, or use the sidebar assistant.
2. Try: “Campus-wise enrolments ka bar chart bana do.” A vague “make a chart” request asks for preferences; a specified request proceeds directly.
3. The assistant can proactively add a chart for comparisons/trends. Use the view selector for bar, line, area, pie, table or a category overview diagram. Hover/focus plotted marks or choose table for exact values.
4. Drag the chart's grip directly onto any dashboard chart to replace it, or onto an insertion gap between charts to add it there. Pin appends it to the same dashboard layout. The widget collapses from full screen when dragging so the dashboard is reachable.
5. Move or delete any original or AI chart using its toolbar. Dragging onto an occupied chart replaces that chart; inserting between charts preserves the others. The position dropdown and Pin provide keyboard/touch alternatives. Changes persist per account; deleting a dashboard chart preserves its source data and chat artifact.

Charts are interactive SVG/data components, not generated images. They are timestamped query snapshots, not continuously refreshed subscriptions. Ask the assistant for a fresh chart when current values are needed. Original and AI charts now share the main responsive dashboard grid (up to 100 charts), with no separate AI section. Positions follow the grid order, not absolute pixel coordinates. Changing the view type is a local display choice; the saved artifact retains its original type.

## Re-running checks

```text
npm run lint
npx tsc --noEmit
npm run build
npm run test:ai-charts
npm run test:agent-live
npm run ai:benchmark
```

Live tests require `.env.local`. Set `TEST_BASE_URL` if the server uses a port other than 3000; this session moved the Saylani preview to **http://127.0.0.1:3001** because another project occupied port 3000. Benchmarks call paid/quota-limited external APIs and intentionally pause between cases. The chart integration test verifies exact database counts, provenance, access control, input validation, and pin/move/reload/remove behavior. Browser checks cover SVG rendering, view switching, tables and placement controls; an authenticated browser walkthrough was not performed because no login password was supplied.

Implementation follows the official [Gemini OpenAI-compatible API documentation](https://ai.google.dev/gemini-api/docs/openai), [Gemini models documentation](https://ai.google.dev/gemini-api/docs/models), and [Groq local tool calling documentation](https://console.groq.com/docs/tool-use/local-tool-calling).

Dashboard layout regression: `npx tsx --env-file=.env.local scripts/test-dashboard-layout.ts` checks original/AI replacement, insertion, reorder, delete, saved reload, stale revisions and account isolation, using temporary test documents that are cleaned up.

## Latency update

Groq GPT-OSS 120B is now tried first, with Gemini Flash as fallback (`AI_PRIMARY_PROVIDER` can reverse the order). Each provider has one shared 20-second budget across credentials; timeouts and server errors no longer trigger another slow retry. Existing database evidence and chart validation remain enabled. The live campus chart regression completed in 10.6 seconds compared with the earlier recorded 89.7-second Gemini run (individual samples, not a latency guarantee). `scripts/test-ai-latency.ts` covers counts, unavailable salary data and chart clarification.

## Automatic visual explanations

The assistant evaluates each question semantically and receives visualization hints alongside chartable aggregate results. The final check no longer depends on English chart keywords. Category comparisons suggest bar charts; dated observations suggest lines. Single values, raw personal records, incomplete numeric rows and ambiguous labels do not receive automatic suggestions. The model still judges relevance, respects text-only preferences and uses only verified query evidence to create charts. Live implicit campus-comparison test: chart and explanation in 5.8 seconds, with all 114 enrolments verified and conversation persistence checked.
