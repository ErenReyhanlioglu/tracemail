# ADR-0002: Release Tagging and Versioning

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

Version numbers earn their keep mainly in libraries, where the number tells
consumers whether an update will break their code. TraceMail is a single
service running in one place, with no other software depending on it. A
strict versioning discipline here would be ceremony with nothing behind it.

Tags still have two real uses:

1. They mark known-good points that can be returned to.
2. They show someone reading the repository how the project progressed.

Separately, several things in this system change independently of the code
and need their own identity: prompts, parsers, and data schemas.

## Decision

### Code tags

- **One tag per phase**, SemVer-shaped. The numbers below are illustrative of
  the pattern, not a fixed plan:
  - core phase complete → `v0.1.0`
  - intelligence layer → `v0.2.0`
  - interface → `v0.3.0`
  - meaningful fixes in between → patch numbers (`v0.1.1`)
- **`v1.0.0`** is tagged when all three phases run in production without
  issues. The exact criterion is to be stated in measurable terms (for
  example, N consecutive days of successful runs on the health panel) before
  that tag is cut.
- **Every tag gets a short GitHub Release note**: three or four lines on what
  was added and what changed. The release note is the single place for
  change history — there is no `CHANGELOG.md`.
- When a release requires a dbt `--full-refresh` or a replay from raw data
  (because of a schema or parser change), the release note says so.

### Deployment is independent of tags

- **Deploy from `main`, not from tags.** Every change that reaches `main` and
  passes CI is deployed to the VM. A tag is only a marker.
- Images are tagged with the commit SHA. Rolling back means restarting the
  previous SHA's images; no rebuild.
- The deployed commit's short SHA (and the nearest tag, if any) is baked into
  the image at build time and shown on the health panel. The running service
  never shells out to `git`.

### Versions that live outside the code version

- **Prompts** are versioned by their own identifier (for example,
  `extract-v3`, `match-v5`), which is also the prompt file's name. The
  identifier is written to every LLM call record and to every MLflow
  evaluation run. A prompt change does not require a new code version, but
  which prompt ran at which accuracy is always traceable.
- **Parsers** follow the same rule: `PARSER_VERSION` per parser, written to
  every parsed row.
- **Data schema changes** are not numbered separately; they are described in
  the release note of the tag that ships them.

## Rationale

Alternatives considered:

1. **Strict SemVer with a release on every change.** Rejected: there is no
   consumer to whom a version number communicates compatibility. Bumping
   versions per change would be busywork in a single-person project.
2. **Deploy on tag.** Rejected: every small fix would require cutting a tag to
   reach production, which adds friction and fills the tag list with noise
   that hides the meaningful milestones.
3. **No tags at all.** Rejected: loses the known-good rollback points and the
   readable progression that matters for a portfolio project.
4. **Keep a `CHANGELOG.md` alongside GitHub Releases.** Rejected: the same
   content in two places drifts. GitHub Releases are attached to the tags and
   are what a reader of the repository will see.
5. **Version prompts and parsers through git tags or the code version.**
   Rejected: they change on a different cadence than the code, and the
   question that matters ("which prompt produced this verdict, at what
   evaluated accuracy?") is answered by recording the identifier on each
   call and run, not by the repository's tag.

## Consequences

**Positive:**

- "What is running in production?" always has an answer on the health panel.
- Rollback is a restart of a previous image, not a rebuild or a revert
  under pressure.
- Small fixes reach production without ceremony.
- Prompt, parser, and code changes are each traceable on their own axis.

**Negative / trade-offs:**

- Because every merge to `main` deploys, `main` must always be deployable.
  Direct commits to `main` are not allowed: every change arrives through a
  pull request that passes CI, enforced by branch protection. CI is the only
  gate between a merge and production.
- Tags depend on the owner remembering to cut them at phase boundaries. A
  missed tag loses nothing operationally, only a marker.
- A rollback across a release that required a full refresh or replay also
  needs that data step reversed; the release note is the record of when this
  applies.
