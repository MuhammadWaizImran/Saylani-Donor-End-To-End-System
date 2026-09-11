# AI rate-limit investigation — 2026-09-11

## Observations

The reported quota message was selected whenever any provider failure contained
`429`, even if another provider failed authentication, configuration, or networking.
It did not establish that all providers were out of quota. Three configured local
credentials (two Groq, one Gemini) each returned HTTP 200 during a small live probe.
The historical production-log query returned no matching incident, so the exact
upstream failure behind the user's report remains unconfirmed.

One question may require up to eight inference rounds. Previously every round
restarted from the primary provider, including after a successful fallback. Rate
limit responses ignored Retry-After. The UI also resent failed assistant messages
and unbounded conversation history, although the engine only used twelve messages.
After 100 UI messages this could cause request validation failures.

Refresh is not a provider quota reset. It can reduce in-memory context and enough
time can pass for a temporary limit to reset. These are plausible explanations,
not a reproduced diagnosis of the original incident.

## Changes

- Track preferred successful provider and blocked credential slots within one
  agent run. Later rounds prefer the working fallback and respect cooldowns.
- Try configured alternate credentials and providers. If all fail and a 429
  cooldown expires within 1.5 seconds, retry inference once after that delay.
  Never automatically replay database tool execution or the whole agent turn.
- Preserve cancellation and a shared 20-second deadline per provider attempt.
- Classify HTTP failures with safe metadata. Distinguish all-rate-limit failures
  from access/configuration failures and timeouts. Never infer permanent quota
  exhaustion from HTTP 429 alone. No provider bodies or API keys are logged.
- Exclude failed assistant messages from future requests; send the last twelve
  eligible messages, matching the existing engine history window.

## Validation

`npx tsx scripts/test-provider-failover.ts` covers primary server failure,
alternate credentials, shared deadline, cancellation, fallback preference across
rounds, short 429 recovery, long cooldown without immediate retry, mixed 429/401
classification, and cancellation during retry delay.

TypeScript, ESLint and production build pass. The existing AVIF optimization
warning remains. `scripts/test-chat-followup.ts` checks two consecutive live
database questions in one conversation, verifies results against MongoDB and
removes only its own temporary evaluation documents.

## Operational limits

This is request-scoped recovery, not a distributed quota scheduler. Concurrent
users and long conversations can still exhaust provider limits. Two Groq keys
under one organization do not create independent organization quotas:
https://console.groq.com/docs/rate-limits . Fallback improves availability only
when another configured provider has capacity. Increasing real account capacity
may still be required for sustained traffic.
