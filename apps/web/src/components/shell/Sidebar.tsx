// Navigation as in the v2 mockups (ADR-0052): the overview, then grouped
// sections, quick views, the health panel, and the developer's links, each
// group under a mono label (rows: SidebarParts.tsx; access: navItems.ts).
// Wide screens only; phones get the bottom bar (ADR-0047). The sidebar
// collapses to its icons; labels stay in the markup for screen readers and
// show as a tooltip (ADR-0041). A clicked section shows as current at once,
// before its page arrives (ADR-0049).
import { cookies } from "next/headers";

import type { Viewer } from "@/lib/load";
import { isCollapsed, SIDEBAR_COOKIE } from "@/lib/sidebar";
import { strings } from "@/lib/strings";

import { LogoMark } from "../icons/LogoMark";
import { PendingNavigation } from "../navigation/Pending";
import { NAV, type NavGroup, type NavItem, type Section } from "./navItems";
import { DEVELOPER_LINKS, VIEWS } from "./sidebarLinks";
import { SidebarFooter } from "./SidebarFooter";
import { ExternalLink, Group, SectionItem, ViewLink } from "./SidebarParts";
import { SidebarToggle } from "./SidebarToggle";
import styles from "./Sidebar.module.css";

const SIDEBAR_ID = "sidebar";
const groups = strings.nav.groups;

function inGroup(group: NavGroup | undefined): NavItem[] {
  return NAV.filter((item) => item.group === group);
}

function Sections({
  group,
  active,
  viewer,
}: {
  group: NavGroup | undefined;
  active: Section;
  viewer: Viewer;
}) {
  return inGroup(group).map((item) => (
    <li key={item.label}>
      <SectionItem item={item} active={active} viewer={viewer} />
    </li>
  ));
}

export async function Sidebar({ active, viewer }: { active: Section; viewer: Viewer }) {
  const collapsed = isCollapsed((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <nav id={SIDEBAR_ID} className={styles.sidebar} aria-label={strings.appName}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>
          <LogoMark className={styles.logo} />
          <span className={styles.brandName}>{strings.appName}</span>
        </span>
        <SidebarToggle
          initialCollapsed={collapsed}
          controls={SIDEBAR_ID}
          className={styles.collapseButton}
        />
      </div>
      <PendingNavigation>
        <div className={styles.groups}>
          <Group>
            <Sections group={undefined} active={active} viewer={viewer} />
          </Group>
          <Group label={groups.tracking}>
            <Sections group="tracking" active={active} viewer={viewer} />
          </Group>
          <Group label={groups.views}>
            {VIEWS.map((view) => (
              <li key={view.label}>
                <ViewLink view={view} viewer={viewer} />
              </li>
            ))}
          </Group>
          <Group label={groups.system}>
            <Sections group="system" active={active} viewer={viewer} />
          </Group>
          <Group label={groups.developer}>
            {DEVELOPER_LINKS.map((link) => (
              <li key={link.label}>
                <ExternalLink link={link} />
              </li>
            ))}
          </Group>
        </div>
      </PendingNavigation>
      <SidebarFooter viewer={viewer} />
    </nav>
  );
}
