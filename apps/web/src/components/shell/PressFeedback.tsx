"use client";

// iOS Safari applies :active only when the page listens for touches, so the
// pressed state (ADR-0047) would never show on an iPhone without this empty
// listener. Passive, so it never delays scrolling.
import { useEffect } from "react";

function noop(): void {}

export function PressFeedback() {
  useEffect(() => {
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}
