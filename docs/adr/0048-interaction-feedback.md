# ADR-0048: Interaction Feedback — Pressing and Hover

**Date:** 2026-10-15
**Status:** Accepted (2026-10-16)

## Context

Clicks on the site felt dead, on the desktop and on phones, while the
locked pages' mail game felt immediate. The game answers the moment a
finger or button goes down, with movement and sound. The site's controls
had no pressed state at all: on the desktop only hover changed a colour,
and on phones, once hover and the browser's tap flash were dealt with
(below), a press showed nothing.

Measured on production on 2026-10-15 (visitor, headless Chrome), from a
click on a navigation link to the first visible change (the link becoming
current):

| Destination | Time |
|---|---|
| Postings, applications (have `loading.tsx`) | 17 to 31 ms |
| Health panel, match reports (no `loading.tsx`) | 135 to 199 ms |

About 0.1 second is the limit for a system to feel as if it reacts
instantaneously [1]. The second row is over it; what a click shows while
the next page loads is left for a later decision (see Consequences).

Two touch-screen problems showed up while the phone layout (ADR-0047) was
reviewed:

- **Sticky hover.** A tapped control kept its hover colour until the next
  tap elsewhere: touch browsers treat the last tapped element as hovered.
  The `hover` media feature tells whether the primary input can hover;
  many mobile devices report `none` [2].
- **Tap flash.** Mobile Chrome and Safari draw their own translucent
  highlight over a tapped link or button, set by the non-standard
  `-webkit-tap-highlight-color` [3]. It covered the site's own colours,
  the game's canvas included.

On iOS, Safari applies `:active` only on a page that handles touch events;
with no touch handler, pressed styles never show [4][5].

## Decision

1. **Every control answers the moment it is pressed** (`:active`), within
   80 ms, below the 0.1 s limit [1]. By kind:
   - **Controls** (buttons, the theme switch, sidebar and bottom-bar items,
     filters, page numbers, menus, the game's buttons): shrink to 96% and
     tint.
   - **Rows** (deployments, incidents, menu items): tint, without
     shrinking; a full-width row that shrinks looks broken.
   - **Text links**: dim to 60% opacity.
   - A selected filter or the current page shrinks without changing
     colour; a disabled control does not answer.
2. **Reduced motion**: pressed controls tint without shrinking.
3. **Values in one place**, `globals.css`: `--press-scale`,
   `--press-duration`, `--press-opacity`, `--color-pressed`,
   `--color-sidebar-pressed`. Each component keeps its own pressed rule in
   its own stylesheet, next to its other states (ADR-0047's layout
   rules).
4. **iOS**: one passive `touchstart` listener on the document
   (`PressFeedback`), so Safari applies `:active` [4][5]. Passive, so it
   never delays scrolling.
5. **Hover only where a pointer can hover**: every hover rule sits in
   `@media (hover: hover)` [2]. Keyboard focus (`:focus-visible`) is not
   affected and shows on every device.
6. **No browser tap flash**: `-webkit-tap-highlight-color: transparent`
   site-wide [3]; the pressed state replaces it with the site's own
   response.

## Rationale

Alternatives considered:

1. **Keep the browser's tap flash as the only feedback.** Rejected: it
   exists only on touch screens, draws its own colour over the design, and
   gives the desktop nothing.
2. **A ripple, as Material draws it.** Rejected: it needs script and an
   extra element per control for an effect the site does not use
   anywhere else; a scale and a tint answer as fast.
3. **The same shrink for everything.** Rejected for rows and text links:
   shrinking a full-width row or a word in a sentence moves the layout
   around it.

## Consequences

**Positive:** a press is visible at once on every device; tapped controls
no longer keep a stale colour; the press values change in one file.

**Negative / trade-offs:**

- `-webkit-tap-highlight-color` is non-standard [3]; if a browser drops
  it, the old flash returns alongside the pressed state, which still
  works.
- WebKit has open bugs where `:active` stays on while a finger scrolls a
  list [6]; to be checked on an iPhone.
- **Verified:** with a held mouse button in headless Chrome, the theme
  button and a bottom-bar icon scale to 0.96 and tint, a deployment row
  tints, a panel link dims to 0.6, and all four return on release. A
  tapped control's background stays transparent under touch emulation.
  **Not verified:** headless Chrome's touch emulation does not trigger
  `:active` at all, so the pressed state under a real finger, and on iOS
  in particular, is still to be seen on a device.
- **Open:** loading and transition states (a loading boundary on every
  route, when a skeleton shows, pending buttons) are a separate decision,
  taken up later with the owner (roadmap).

## References

1. [Response Times: The 3 Important Limits — Nielsen Norman Group](https://www.nngroup.com/articles/response-times-3-important-limits/)
2. [hover — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover)
3. [-webkit-tap-highlight-color — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-tap-highlight-color)
4. [Bug 138816 — WebKit Bugzilla](https://bugs.webkit.org/show_bug.cgi?id=138816) (known from search-result summaries: Mobile Safari applies `:active` on touchstart, and not on pages without touch handlers)
5. [Safari Web Content Guide — Apple](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/) (not read directly; its `ontouchstart` advice known only through secondary sources quoting it)
6. [Bug 221366 — WebKit Bugzilla](https://bugs.webkit.org/show_bug.cgi?id=221366) (known from search-result summaries)
