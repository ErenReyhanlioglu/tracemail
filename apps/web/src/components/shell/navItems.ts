// The app's sections, shared by the sidebar (wide screens) and the bottom
// bar (phones, ADR-0047). Every section but the public health panel belongs
// to the owner; a visitor sees them with a lock and each opens its locked
// page (ADR-0040, note of 2026-10-15). Sections not built yet are dimmed for
// the owner.
import type { ComponentType } from "react";

import type { Viewer } from "@/lib/load";
import { PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

import {
  ApplicationsIcon,
  HealthIcon,
  OverviewIcon,
  PostingsIcon,
  ReportsIcon,
} from "../icons/NavIcons";

export type Section = "overview" | "postings" | "applications" | "reports" | "health";

export interface NavItem {
  label: string;
  // The bottom bar's label: five fit across a 320 px screen.
  shortLabel: string;
  icon: ComponentType;
  section: Section;
  href: string;
  ownerOnly?: boolean;
  // Built for the owner; a section that is not is dimmed for the owner.
  ready?: boolean;
}

// The sidebar and the bottom bar show one current section; a click moves it
// at once (ADR-0049).
export const SECTION_GROUP = "section";

export const NAV: readonly NavItem[] = [
  {
    label: strings.nav.overview,
    shortLabel: strings.nav.short.overview,
    icon: OverviewIcon,
    section: "overview",
    href: "/overview",
    ownerOnly: true,
  },
  {
    label: strings.nav.postings,
    shortLabel: strings.nav.short.postings,
    icon: PostingsIcon,
    section: "postings",
    href: "/postings",
    ownerOnly: true,
    ready: true,
  },
  {
    label: strings.nav.applications,
    shortLabel: strings.nav.short.applications,
    icon: ApplicationsIcon,
    section: "applications",
    href: "/applications",
    ownerOnly: true,
    ready: true,
  },
  {
    label: strings.nav.reports,
    shortLabel: strings.nav.short.reports,
    icon: ReportsIcon,
    section: "reports",
    href: "/reports",
    ownerOnly: true,
  },
  {
    label: strings.nav.health,
    shortLabel: strings.nav.short.health,
    icon: HealthIcon,
    section: "health",
    href: PANEL_PATH,
    ready: true,
  },
];

export function isLocked(item: NavItem, viewer: Viewer): boolean {
  return Boolean(item.ownerOnly) && viewer !== "owner";
}

// Not a link: built later, and the viewer is the owner.
export function isComingLater(item: NavItem, viewer: Viewer): boolean {
  return !isLocked(item, viewer) && !item.ready;
}
