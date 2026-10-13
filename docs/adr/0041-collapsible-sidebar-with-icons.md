# ADR-0041: Collapsible Sidebar with Section Icons

**Date:** 2026-10-13
**Status:** Accepted

## Context

The sidebar of ADR-0034 had text-only items, a tagline under the product
name, and text tags ("yakında", "özel") on sections that cannot be opened.
The owner asked for an icon per section, a sidebar that collapses to its
icons, sections not built yet shown only dimmed, a lock symbol instead of
the "özel" tag for visitors (ADR-0040), and the product name without the
tagline.

Guidance read on 2026-10-13:

- **Icon labels** [1]: "a text label must be present alongside an icon to
  clarify its meaning", labels "should be visible at all times", and
  "Don't rely on hover to reveal text labels"; for navigation, labels are
  "particularly critical".
- **Disclosure button** [2]: the control that shows and hides content is a
  button with `aria-expanded`, optionally `aria-controls`, operated with
  Enter and Space.
- **Icon-only items** [3]: each needs an accessible name in the markup; a
  visible tooltip alone is not enough.

## Decision

1. **Expanded by default, collapsed by choice.** The sidebar shows icons
   with labels. A button at its top collapses it to an icon column; the
   choice is stored in a cookie and rendered by the server on the next load,
   like the theme (ADR-0034). A first-time visitor always sees the labels.
2. **Collapsed items keep their names.** Labels are hidden visually only,
   so screen readers still read them, and each item shows its label as a
   native tooltip on hover. The toggle is a disclosure button
   (`aria-expanded`, `aria-controls`) [2].
3. **Unavailable sections** are dimmed and not links. Sections not built
   yet carry no visible tag; sections locked for a visitor show a lock
   icon. The reason ("yakında", "yalnızca hesap sahibi") is read to screen
   readers only.
4. **Icons are drawn inline** like the app's existing icons, no icon
   library: paths from Lucide 1.48.0 [4] (ISC; three derive from Feather,
   MIT), with the full license next to them
   (`apps/web/src/components/icons/LICENSE-lucide.txt`).
5. **The tagline is removed**; the sidebar shows only "TraceMail".

## Rationale

1. **Collapsed by default, like many dashboards.** Rejected: icons without
   visible labels are the weaker default [1]; collapsing suits someone who
   already knows the icons.
2. **An icon package (`lucide-react`).** Rejected: ten icons do not justify
   a dependency, and the app already draws its icons inline.
3. **Keep the text tags.** Rejected by the owner; the dimmed style and the
   lock carry the meaning visually, and assistive technology gets it as
   text.

## Consequences

**Positive:**

- Each section is recognizable at a glance, and the content gains width
  when the sidebar is collapsed.

**Negative / trade-offs:**

- A dimmed section without a tag does not say why it is unavailable to a
  sighted user; the lock does for visitors, "not built yet" stays unstated.
- Hover tooltips do not exist on touch screens; this is revisited with the
  mobile layout (ADR-0039), where the sidebar changes anyway.

## References

1. [Icon Usability — Nielsen Norman Group](https://www.nngroup.com/articles/icon-usability/)
2. [Disclosure (Show/Hide) Pattern — W3C WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
3. [Side navigation: accessibility — Intelligence Community Design System](https://design.sis.gov.uk/components/side-navigation/accessibility) (known from search-result summaries)
4. [lucide-static 1.48.0 — npm, via jsDelivr](https://cdn.jsdelivr.net/npm/lucide-static@1.48.0/)
