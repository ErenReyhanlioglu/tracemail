// What the phone's menu sheet holds (ADR-0052): the viewer and the theme
// switch, then the sidebar's quick views and developer links in the
// sidebar's own rows (counts for the owner, locks for a visitor), and
// signing out or in. Rendered by the server inside the client sheet.
import type { Viewer } from "@/lib/load";
import { strings } from "@/lib/strings";

import { PendingNavigation } from "../navigation/Pending";
import styles from "./MobileMenu.module.css";
import { DEVELOPER_LINKS, VIEWS } from "./sidebarLinks";
import { AccountButton, Identity } from "./SidebarFooter";
import { ExternalLink, Group, ViewLink } from "./SidebarParts";
import { ThemeToggle } from "./ThemeToggle";

const groups = strings.nav.groups;

export function MenuSheet({ viewer }: { viewer: Viewer }) {
  return (
    <>
      <div className={styles.account}>
        <Identity viewer={viewer} />
        <ThemeToggle />
      </div>
      <PendingNavigation>
        <Group label={groups.views}>
          {VIEWS.map((view) => (
            <li key={view.label}>
              <ViewLink view={view} viewer={viewer} />
            </li>
          ))}
        </Group>
      </PendingNavigation>
      <Group label={groups.developer}>
        {DEVELOPER_LINKS.map((link) => (
          <li key={link.label}>
            <ExternalLink link={link} />
          </li>
        ))}
      </Group>
      <AccountButton viewer={viewer} />
    </>
  );
}
