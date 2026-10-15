"use client";

// Collapses the sidebar to its icons or expands it again (a disclosure
// button, WAI-ARIA APG). The width is set by data-sidebar on <html>, as the
// theme is, and the choice is stored for the next page load.
import { useState } from "react";

import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE, SIDEBAR_COOKIE_MAX_AGE_SECONDS } from "@/lib/sidebar";
import { strings } from "@/lib/strings";

import { CollapseIcon, ExpandIcon } from "../icons/NavIcons";

export function SidebarToggle({
  initialCollapsed,
  controls,
  className,
}: {
  initialCollapsed: boolean;
  controls: string;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle(): void {
    const next = !collapsed;
    const root = document.documentElement;
    if (next) {
      root.dataset.sidebar = SIDEBAR_COLLAPSED;
    } else {
      delete root.dataset.sidebar;
    }
    const value = next ? SIDEBAR_COLLAPSED : "";
    const age = next ? SIDEBAR_COOKIE_MAX_AGE_SECONDS : 0;
    document.cookie = `${SIDEBAR_COOKIE}=${value}; path=/; max-age=${age}; samesite=lax`;
    setCollapsed(next);
  }

  const label = collapsed ? strings.account.expandSidebar : strings.account.collapseSidebar;
  return (
    <button
      type="button"
      className={className}
      aria-expanded={!collapsed}
      aria-controls={controls}
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      {collapsed ? <ExpandIcon /> : <CollapseIcon />}
    </button>
  );
}
