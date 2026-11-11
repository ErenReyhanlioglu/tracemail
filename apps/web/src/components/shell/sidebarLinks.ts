// The sidebar's quick views and developer links (ADR-0052). A view is a
// list opened on one status group, with its count and the group's status
// color; the saved view spans every period, so it matches its count.
import type { ComponentType } from "react";

import { GITHUB_PROFILE_URL, LINKEDIN_URL, PORTFOLIO_URL } from "@/lib/links";
import { strings } from "@/lib/strings";

import { GitHubIcon, GlobeIcon, LinkedInIcon } from "../icons/NavIcons";
import type { CountKey } from "./navItems";

// A view's dot: the status color of its group; waiting is a hollow ring.
export type ViewTone = "attention" | "waiting" | "accent" | "error";

export interface ViewItem {
  label: string;
  href: string;
  count: CountKey;
  tone: ViewTone;
}

export interface ExternalItem {
  label: string;
  href: string;
  icon: ComponentType;
}

const text = strings.nav;

export const VIEWS: readonly ViewItem[] = [
  {
    label: text.views.inProgress,
    href: "/applications?filter=in_progress",
    count: "inProgress",
    tone: "attention",
  },
  {
    label: text.views.waiting,
    href: "/applications?filter=waiting",
    count: "waiting",
    tone: "waiting",
  },
  {
    label: text.views.saved,
    href: "/postings?status=saved&period=all",
    count: "saved",
    tone: "accent",
  },
  {
    label: text.views.rejected,
    href: "/applications?filter=rejected",
    count: "rejected",
    tone: "error",
  },
];

export const DEVELOPER_LINKS: readonly ExternalItem[] = [
  { label: text.links.github, href: GITHUB_PROFILE_URL, icon: GitHubIcon },
  { label: text.links.linkedin, href: LINKEDIN_URL, icon: LinkedInIcon },
  { label: text.links.portfolio, href: PORTFOLIO_URL, icon: GlobeIcon },
];
