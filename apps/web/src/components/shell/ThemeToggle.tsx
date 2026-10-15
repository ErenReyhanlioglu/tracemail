"use client";

// Light/dark switch with sun and moon icons. Without a stored choice the
// page follows the system setting; a click stores the opposite of what is
// shown now. The knob position and the accessible name are chosen by CSS,
// so both are right on the first paint. On phones it is an icon button the
// size of its neighbours, the sun and moon turning into each other
// (ADR-0047).
import { strings } from "@/lib/strings";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE_SECONDS, type Theme } from "@/lib/theme";

import styles from "./ThemeToggle.module.css";

function effectiveTheme(): Theme {
  const stored = document.documentElement.dataset.theme;
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function toggle(): void {
  const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

function Labels() {
  return (
    <>
      <span className={`${styles.srOnly} ${styles.labelForLight}`}>
        {strings.account.themeToDark}
      </span>
      <span className={`${styles.srOnly} ${styles.labelForDark}`}>
        {strings.account.themeToLight}
      </span>
    </>
  );
}

export function ThemeIconButton({ className }: { className?: string }) {
  return (
    <button type="button" className={`${className ?? ""} ${styles.iconButton}`} onClick={toggle}>
      <span className={styles.iconSun}>
        <SunIcon />
      </span>
      <span className={styles.iconMoon}>
        <MoonIcon />
      </span>
      <Labels />
    </button>
  );
}

export function ThemeToggle() {
  return (
    <button type="button" className={styles.toggle} onClick={toggle}>
      <span className={styles.knob}>
        <span className={styles.sun}>
          <SunIcon />
        </span>
        <span className={styles.moon}>
          <MoonIcon />
        </span>
      </span>
      <Labels />
    </button>
  );
}
