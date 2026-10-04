# ADR-0001: No Retrieval in Matching; Embeddings Only for Phase 4 Rough Ranking

**Date:** 2026-10-03
**Status:** Accepted (embedding part not yet implemented)

## Context

SUMMARY.md listed "local embedding model and LLM evaluation" under matching,
without saying where the embedding model sits. Two different features could
use it:

1. **Two-step matching (Phase 2).** Postings with full text are matched
   against the master profile: step 1 extracts requirements with their
   verbatim sentences, step 2 gives each requirement a verdict with evidence
   quoted from the profile. An embedding model could pre-select candidate
   evidence for each requirement before the LLM sees it (retrieval).
2. **Rough fit ranking (Phase 4).** Job-alert postings arrive with only a
   title and company, no full text. They cannot go through two-step matching,
   but the overview and incoming-postings screens still need a rough
   High / Medium / Low signal for them.

The master profile is a single hand-written file, small enough to fit in one
LLM call with ample room. Call volume is 5–10 per day.

## Decision

- **Two-step matching uses no embeddings.** The full master profile is passed
  to the LLM as context on every verdict call. There is no retrieval or
  pre-matching step between requirements and evidence.
- **Embeddings are used only for Phase 4 rough ranking.** Alert postings are
  ranked by the similarity of their title to a profile summary. The model runs
  locally on the VM; no LLM call is made for this.
- **No vector database.** Vectors are computed in memory during the run and
  discarded. BigQuery stores the result per posting: score, fit bucket, model
  name, model version, and profile-summary version. Everything can be
  recomputed from raw data and the current profile summary.
- **Phases 1–3 add no embedding-related dependency, code, or infrastructure.**

Constraints on the Phase 4 implementation:

- The model must be **multilingual**. Alert titles arrive in both Turkish and
  English ("Yapay Zeka Mühendisi" and "AI Engineer" must land close together).
- Inference runs through an ONNX runtime, not PyTorch, to keep the `arm64`
  image small.
- The High / Medium / Low thresholds are **calibrated against a small set of
  titles labeled by the owner**, not picked by hand. Raw cosine similarity has
  no meaning across models.
- The profile summary is a separate file **written by the owner**, under the
  same rules as the master profile. It is not generated from the master
  profile by an LLM — that would make this LLM-free step depend on an LLM.

## Rationale

Alternatives considered:

1. **Retrieval before the verdict (embed profile chunks, pass top-k per
   requirement).** Rejected. Its failure mode is the worst one for this
   report: if retrieval misses the right evidence, the model correctly
   reports "no evidence" for evidence that exists — a false `missing` that
   looks well-founded. With the whole profile in context, this error class
   does not exist. Retrieval saves tokens, but at this profile size and call
   volume the saving is negligible. Passing the whole profile also keeps the
   substring check on quoted evidence simple: there is one source to check
   against.
2. **Use the cheap LLM for rough ranking.** Rejected. Alerts are the
   highest-volume input; an LLM call per alert title would multiply call
   count and cost for a signal that is explicitly rough. A local model makes
   this step free and keeps it out of the LLM budget.
3. **Store vectors in a vector database (Qdrant or similar).** Rejected. A few
   hundred short titles need no index; a vector store would be infrastructure
   with no workload to justify it, and conflicts with the scope rule against
   unneeded components.
4. **Store vectors in BigQuery.** Not needed. Titles are short and the model is
   local, so recomputing is cheaper than storing and keeping vectors in sync
   with model and profile-summary versions.

## Consequences

**Positive:**

- The match report cannot fail because of a retrieval miss.
- Phases 1–3 carry no embedding model, no ONNX runtime, and no extra image
  size.
- Rough ranking adds no LLM cost and does not touch the monthly budget cap.
- Rough-ranking results are reproducible: model version and profile-summary
  version are recorded with every score.

**Negative / trade-offs:**

- Every verdict call carries the full profile. If the profile grows
  substantially (for example, several times its current size), token cost
  and the risk of the model overlooking evidence both rise — revisit this
  decision then.
- Title-only similarity is a weak signal: a title says little about the actual
  requirements. The UI must present it as rough and keep it visually distinct
  from the evidence-based match report.
- One more owner-maintained file (the profile summary) and one more labeled
  set (calibration titles) to keep in sync with the master profile.
