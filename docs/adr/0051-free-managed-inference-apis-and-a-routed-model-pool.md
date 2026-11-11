# ADR-0051: Free Managed Inference APIs and a Routed Model Pool

**Date:** 2026-10-18
**Status:** Accepted (not yet implemented)

## Context

Phase 2 adds LLM calls: reply classification for unclaimed mail and two-step
matching of captured postings against the master profile. SUMMARY.md planned
these calls through Gemini on Vertex AI (Gemini Enterprise Agent Platform),
and listed "the list of models to compare" as an open decision.

Two constraints changed the plan:

- **No spending.** The owner does not accept a paid LLM bill, not even a
  capped one of a few dollars a month, and the GCP account has no trial
  credit left. Vertex AI has no permanent free quota for Gemini [1].
- **The goal is the competency, not the vendor.** The competency the project
  must show is calling a managed inference API through one
  provider-independent interface. Vertex AI was one way to show it, not a
  requirement.

The data sent to an LLM falls into two classes:

| Use | Data sent | Sensitivity |
|---|---|---|
| Reply classification | Mail from companies and recruiters, with third-party names and correspondence | High |
| Matching | Public posting text and the owner's own master profile | Low |

The owner accepts that mail is sent to a third-party inference provider, as
long as that provider does not train on it. The owner does not care which
model answers.

### Options checked

**Self-hosting a model on the VM (Ollama, llama.cpp).** The VM is an Always
Free Ampere A1 with 2 OCPUs and 12 GB of memory, which already runs Airflow,
Postgres, the API, the web app, and `cloudflared` (infra/vm/README.md).
Oracle's own llama.cpp test reached about 30 tokens per second for one user
on an 8B model, on a 64-OCPU node [2]. No number exists for this VM; a
2-OCPU result would be far lower, but that is an expectation, not a
measurement. A model server also comes close to "endpoint deployment" in
SUMMARY.md's out-of-scope list, and competes with Airflow for memory.

**Free API tiers.** Read on 2026-10-18 from each provider's own pages, except
where marked:

- **Gemini API free tier.** Google uses free-tier inputs and outputs to
  improve its products, human reviewers may read them, and the terms say
  "Do not submit sensitive, confidential, or personal information to the
  Unpaid Services" [3]. Paid-tier data terms apply to unpaid use only in the
  EEA, Switzerland, and the UK [3]. Not eligible for either data class.
- **Groq.** The Services Agreement says "Groq is not permitted to use Inputs
  or Outputs for training or fine-tuning any AI Model Services or other
  models" (§4.2), and covers services designated as fee-free (§5.1) [4].
  By default, inference requests are not retained; logs kept for
  troubleshooting or abuse investigation are held for up to 30 days [5].
  The rate-limit page lists 30 requests per minute, 1,000 per day, 8,000
  tokens per minute, and 200,000 tokens per day for `openai/gpt-oss-120b`,
  `openai/gpt-oss-20b`, and `qwen/qwen3.8-27b`; the page does not say
  whether that table is the free plan [6]. The API is OpenAI-compatible at
  `https://api.groq.com/openai/v1` [7]. Strict JSON-schema output is
  supported on those three models [8].
- **Cloudflare Workers AI.** "Cloudflare does not use Customer Content
  processed by Workers AI to train AI models" [9]; the page does not
  separate the free plan. The free plan gives 10,000 Neurons a day, reset at
  00:00 UTC; beyond that, requests fail and nothing is billed [10]. Prices
  in Neurons per million tokens, for example `@cf/openai/gpt-oss-120b`
  31,818 input and 68,182 output, `@cf/openai/gpt-oss-20b` 18,182 and
  27,273 [10]. An OpenAI-compatible endpoint exists at
  `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1` [11].
  JSON-schema mode is listed for a few models (for example
  `@cf/meta/llama-3.3-70b-instruct-fp8-fast`), and Cloudflare "can't
  guarantee that the model responds according to the requested JSON
  Schema" [12].
- **Others** in a community list of free tiers [13], not read on the
  providers' own pages: Mistral's free mode trains on inputs unless the
  account opts out; NVIDIA NIM's free endpoints ask users not to submit
  personal data; OpenRouter and Kilo Code free models may be routed to
  providers that log prompts; Cohere's trial is limited to 1,000 calls a
  month and non-commercial use; ModelScope and SiliconFlow require identity
  verification. None of them is needed while Groq and Cloudflare qualify.

Free models are also withdrawn without much notice. Groq, for example, shut
down `qwen/qwen3.6-27b` on 2026-09-14 [13]. A design that depends on one free
model breaks when that model goes away.

## Decision

1. **LLM calls go to free managed inference APIs.** The starting providers are
   Groq and Cloudflare Workers AI. Vertex AI is not used. No call is ever
   billed.
2. **One provider-independent interface, routed over a model pool.** Each
   tier (classification, matching) has an ordered pool of
   `(provider, model, quotas)` entries in config. The router tries entries in
   order. An entry is skipped when its quota for the day is used up, or when
   the provider answers with a rate-limit or availability error. When every
   entry is exhausted, the item is skipped, recorded, and picked up by a
   later run, as with the budget cap. No load balancing, no scoring.
3. **A model enters a pool only if it passes two checks:**
   - **Data terms.** The provider's own documentation states that inputs and
     outputs are not used for training. This is required for both tiers,
     including matching, which keeps one rule instead of two.
   - **Measurement.** The model has a recorded golden-set result at or above
     the tier's accuracy threshold. An unmeasured model cannot enter a pool.
4. **One item, one model.** All calls for one posting's match report (or one
   mail's classification) use the model the router picked for that item. A
   report never mixes models. The report records which model produced it.
5. **The monetary cap stays, set to zero.** Each model's unit price lives in
   the price config (ADR-0017). The budget check refuses any call whose
   price is not zero, so a paid model cannot be used by accident. Per-model
   daily quotas are checked against the usage logged in `ops.llm_calls`,
   read once per run and counted in memory during the run.
6. **The CI eval gate measures every model in the pool.** A prompt change
   fails if any pool model drops below its own recorded baseline. A model
   withdrawn by its provider fails the gate explicitly; replacing it means a
   new golden-set result, recorded as a new ADR.
7. **Metrics are split by model.** Weekly LLM metrics (schema errors,
   retries, unsupported verdicts, verdict distribution) are reported per
   model with raw counts, so a shift caused by routing is not read as drift.
   Every call log row records the model and whether it was a fallback.

The concrete pool is picked by the golden-set comparison. The candidates to
measure are `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, and
`qwen/qwen3.8-27b` on Groq, and `@cf/openai/gpt-oss-120b`,
`@cf/openai/gpt-oss-20b`, and `@cf/meta/llama-3.3-70b-instruct-fp8-fast` on
Workers AI. This closes the open decision in SUMMARY.md.

## Rationale

- **Paid Vertex AI** was rejected by the owner on cost.
- **Gemini API free tier** fails the data terms for both tiers [3].
- **Self-hosting** was rejected: the VM is too small for the matching model,
  the service would compete with Airflow for memory, and it approaches the
  out-of-scope "endpoint deployment". It could be measured for
  classification only if sending mail out ever became unacceptable.
- **One fixed free model** was rejected: free models disappear, and quotas
  are small. A single model would stop the feature on its first quota error.
- **A routing library (for example LiteLLM)** was rejected: the need is an
  ordered fallback over a handful of models, which fits in a small tested
  module behind the existing `Protocol`, without a large dependency.
- **Different data rules per tier** were rejected for now: Groq and
  Cloudflare satisfy the stricter rule, so one rule is simpler. Revisit only
  if a much better matching model is available solely on terms that train
  on inputs.

## Consequences

**Positive:**
- Phase 2 costs nothing, and no call can be billed by mistake.
- The competency is shown more strongly: a managed inference API behind one
  interface, with quota-aware fallback across providers, measured routing
  eligibility, and per-model monitoring.
- Losing one free model degrades the pool instead of stopping the feature.

**Negative / trade-offs:**
- **Capacity is small and only estimated.** Assuming a matching call of
  8,000 input and 1,000 output tokens, `@cf/openai/gpt-oss-120b` costs about
  323 Neurons, about 31 calls a day from the free allowance; Groq's 200,000
  tokens a day give about 22 such calls per model. Both are estimates until
  the profile exists and real calls are logged. Groq's 8,000 tokens per
  minute may not fit a large profile plus a posting in one call.
- **The golden-set comparison spreads over several days**, because the eval
  campaign and the CI gate share the same daily quotas as production.
- **CI cost grows with the pool:** every model is evaluated on every prompt
  change.
- **Structured output is not guaranteed everywhere.** Workers AI's JSON mode
  is best effort [12]. Responses are validated with Pydantic and retried as
  CLAUDE.md requires, whatever the provider claims.
- **Terms and limits can change without notice.** The data-terms check is
  repeated whenever a model is added to a pool.
- **"Cost" in MLflow and on the panel is always zero.** Token counts and the
  share of each daily quota used take its place as the resource measure.
- The API keys for Groq and Cloudflare are new secrets, handled like the
  others (environment, `SecretStr`, never logged). There is no GCP service
  account for the LLM role.

Revisit when the owner accepts a paid budget, when Groq or Cloudflare change
their data terms, or when measured daily usage passes 85% of the pool's
combined quota (CLAUDE.md, 85% rule).

## References

1. [Agent Platform Pricing — Google Cloud](https://docs.cloud.google.com/vertex-ai/generative-ai/pricing)
   (the page loads with JavaScript and could not be read directly; known from
   search-result summaries and secondary pricing articles)
2. [Introducing Meta Llama 3 on OCI Ampere A1 — Oracle](https://blogs.oracle.com/ai-and-datascience/post/introducing-meta-llama-3-on-oci-ampere-a1)
   (known from search-result summaries)
3. [Gemini API Additional Terms of Service — Google](https://ai.google.dev/gemini-api/terms)
4. [Services Agreement — Groq](https://console.groq.com/docs/legal/services-agreement)
5. [Your Data — Groq](https://console.groq.com/docs/your-data)
6. [Rate Limits — Groq](https://console.groq.com/docs/rate-limits)
7. [OpenAI Compatibility — Groq](https://console.groq.com/docs/openai)
8. [Structured Outputs — Groq](https://console.groq.com/docs/structured-outputs)
9. [Data usage — Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
10. [Pricing — Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
11. [OpenAI compatible API endpoints — Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
12. [JSON Mode — Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/features/json-mode/)
13. [awesome-free-llm-apis — GitHub (community list)](https://github.com/mnfst/awesome-free-llm-apis)
