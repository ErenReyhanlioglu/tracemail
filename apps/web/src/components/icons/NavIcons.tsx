// Navigation icons, drawn inline like the app's other icons (no icon
// library, ADR-0034). Paths are from Lucide 1.48.0 (lucide-static), ISC
// License, Copyright (c) 2026 Lucide Icons and Contributors; arrow-down,
// arrow-up, check, chevron-down, clock, lock, log-in, log-out, rotate-cw,
// search, and triangle-alert derive from Feather, MIT License, Copyright (c)
// 2013-present Cole Bemis. The GitHub and LinkedIn marks are the companies'
// filled logos, as drawn in the owner's v2 mockups (ADR-0052).
// Full notices: LICENSE-lucide.txt in this folder.
import type { ReactNode } from "react";

import styles from "./NavIcons.module.css";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      {children}
    </svg>
  );
}

export function OverviewIcon() {
  return (
    <Icon>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </Icon>
  );
}

export function PostingsIcon() {
  return (
    <Icon>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Icon>
  );
}

export function ApplicationsIcon() {
  return (
    <Icon>
      <path d="M12 12h.01" />
      <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M22 13a18.15 18.15 0 0 1-20 0" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </Icon>
  );
}

export function ReportsIcon() {
  return (
    <Icon>
      <path d="M10.5 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v6" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="m14 20 2 2 4-4" />
    </Icon>
  );
}

export function HealthIcon() {
  return (
    <Icon>
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </Icon>
  );
}

export function LockIcon() {
  return (
    <Icon>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  );
}

export function CollapseIcon() {
  return (
    <Icon>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </Icon>
  );
}

export function ExpandIcon() {
  return (
    <Icon>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </Icon>
  );
}

export function SignOutIcon() {
  return (
    <Icon>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icon>
  );
}

export function SignInIcon() {
  return (
    <Icon>
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </Icon>
  );
}

export function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  );
}

export function SortDownIcon() {
  return (
    <Icon>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Icon>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </Icon>
  );
}

export function SortUpIcon() {
  return (
    <Icon>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Icon>
  );
}

export function SortableIcon() {
  return (
    <Icon>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function ChevronDownIcon() {
  return (
    <Icon>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

// A part that cannot be read (ADR-0050): lucide triangle-alert.
export function WarningIcon() {
  return (
    <Icon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

// Retry: lucide rotate-cw.
export function RetryIcon() {
  return (
    <Icon>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </Icon>
  );
}

// A retry in progress: lucide loader-circle, turned by its parent's CSS.
export function SpinnerIcon() {
  return (
    <Icon>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Icon>
  );
}

// The sidebar's developer links and the visitor's avatar (ADR-0052).
export function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.filled}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-1.96c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.filled}>
      <path d="M20.45 2H3.55C2.7 2 2 2.7 2 3.55v16.9C2 21.3 2.7 22 3.55 22h16.9c.85 0 1.55-.7 1.55-1.55V3.55C22 2.7 21.3 2 20.45 2zM8.1 19H5.1V9.5h3V19zM6.6 8.2a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5zM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5s-1.75 1.2-1.75 2.4V19h-3V9.5h2.9v1.3h.04c.4-.76 1.38-1.56 2.85-1.56 3.05 0 3.46 2 3.46 4.6V19z" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </Icon>
  );
}

export function EyeIcon() {
  return (
    <Icon>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function ArrowUpRightIcon() {
  return (
    <Icon>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </Icon>
  );
}

// Resets a narrowed filter (ADR-0052).
export function CloseIcon() {
  return (
    <Icon>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

// How many alert mails carried a posting (ADR-0052).
export function BellIcon() {
  return (
    <Icon>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </Icon>
  );
}

// The login page's way to the health panel (ADR-0052).
export function ArrowRightIcon() {
  return (
    <Icon>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Icon>
  );
}

// Copies an error page's code (ADR-0052).
export function CopyIcon() {
  return (
    <Icon>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Icon>
  );
}

// Opens the phone's menu sheet (ADR-0052).
export function MenuIcon() {
  return (
    <Icon>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Icon>
  );
}
