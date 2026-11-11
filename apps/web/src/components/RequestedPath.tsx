"use client";

// The address a 404 was asked for (ADR-0052): its path only. The query is
// left out, so a token carried in it (a share link's) never shows.
import { usePathname } from "next/navigation";

export function RequestedPath() {
  return <b>{usePathname()}</b>;
}
