# ADR-0033: User-Facing UI Copy Is Turkish

**Date:** 2026-10-11
**Status:** Accepted

## Context

CLAUDE.md keeps everything written to files in English but left the language
of user-facing UI copy open until an ADR settles it. The interface mockups
(`docs/interface_concept/`) are in Turkish. Step 1.10 writes the first UI
strings.

## Decision

All user-facing copy in the web app is Turkish: navigation, headings,
labels, status names, empty states, and error messages shown to people.
Everything else stays English as before: code, identifiers, comments, API
responses, logs, and docs. Dates and relative times are shown in Turkish,
in the `Europe/Istanbul` time zone.

Strings live in one module of the web app, not scattered through
components, so that a second language could be added later without
touching every component.

## Rationale

1. **English UI.** Rejected: the owner reads the app daily and chose
   Turkish; the mockups are already Turkish.
2. **Both languages now.** Rejected: an i18n layer for one reader is
   effort with no current use.

## Consequences

**Positive:**

- The implementation matches the mockups directly.

**Negative / trade-offs:**

- Visitors who do not read Turkish see a Turkish public health panel.
  Revisit before the Phase 3 public panel goes live if it is shared with
  non-Turkish readers; keeping strings in one module keeps that change
  small.

## References

None. This is an owner preference recorded as a decision.
