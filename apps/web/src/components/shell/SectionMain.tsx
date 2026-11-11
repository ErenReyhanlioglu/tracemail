"use client";

// The content area. On a visitor's section change it fades in once
// (ADR-0049, note of 2026-11-11). A section with a loading screen mounts the
// content area twice, loading screen then page; the second mount of the
// same section continues the fade the first began instead of starting it
// again. When the fade began is kept on <html>, which outlives both mounts.
import { type ReactNode, useLayoutEffect, useRef } from "react";

// Longer than a slow loading screen stays up; a visitor returning to the
// same section within it simply sees no fade.
const REPEAT_WINDOW_MS = 2000;

// How far into the section's fade this mount is: 0 for a new section, the
// time since the fade began for the page replacing its loading screen, so
// the fade carries on instead of starting over; null for no fade. The first
// content area in a document is the page the browser loaded, already
// painted from the server's HTML: fading it would flash it.
function fadeElapsed(section: string): number | null {
  const root = document.documentElement.dataset;
  const now = performance.now();
  if (root.fadedSection === undefined) {
    root.fadedSection = section;
    root.fadedAt = String(now);
    return null;
  }
  const since = now - Number(root.fadedAt);
  if (root.fadedSection === section && since < REPEAT_WINDOW_MS) {
    return since;
  }
  root.fadedSection = section;
  root.fadedAt = String(now);
  return 0;
}

export function SectionMain({
  section,
  fade,
  className,
  fadeClassName,
  children,
}: {
  section: string;
  fade: boolean;
  className: string | undefined;
  fadeClassName: string | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // Before the first paint, so the content never shows before it fades.
  useLayoutEffect(() => {
    const main = ref.current;
    const elapsed = fade ? fadeElapsed(section) : null;
    if (main && fadeClassName && elapsed !== null) {
      // A negative delay starts the animation part way through.
      main.style.animationDelay = `${-elapsed}ms`;
      main.classList.add(fadeClassName);
    }
  }, [fade, fadeClassName, section]);
  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  );
}
