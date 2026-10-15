// What a private section shows instead of its data: to a visitor, what it
// holds and that it is never sent here, under the envelope; to the owner, for
// a section not built yet, that it is coming. Nothing here reads the API.
import localFont from "next/font/local";
import Link from "next/link";

import { PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

import styles from "./LockedSection.module.css";
import { MailEasterEgg } from "./MailEasterEgg";

const text = strings.locked;

// The game's pixel font: Silkscreen with the Turkish letters and the arrow
// it lacks drawn on its own grid (fonts/build_pixel_font.py, SIL OFL 1.1).
// Not preloaded: Next.js bundles every page's fonts together, so a preload
// would reach every page (measured: 9.6 KB on the health panel). The game's
// hidden text is on these pages from the start, so the browser fetches the
// font as they open, long before the 1.5 s intro ends.
const pixel = localFont({
  src: "./fonts/TraceMailPixel.woff2",
  variable: "--font-pixel",
  preload: false,
});

export type LockedKey = keyof typeof text.sections;

export function LockedSection({ section, viewer }: { section: LockedKey; viewer: "owner" | "visitor" }) {
  if (viewer === "owner") {
    return (
      <section className={styles.locked} aria-labelledby="locked-title">
        <div className={styles.lock}>
          <h2 id="locked-title" className={styles.title}>
            {text.comingTitle}
          </h2>
          <p className={styles.description}>{text.comingBody}</p>
        </div>
      </section>
    );
  }
  return (
    <section className={`${styles.locked} ${pixel.variable}`} aria-labelledby="locked-title">
      <MailEasterEgg />
      <div className={styles.lock}>
        <h2 id="locked-title" className={styles.title}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {text.title}
        </h2>
        <p className={styles.description}>{text.held(text.sections[section])}</p>
        <Link className={styles.link} href={PANEL_PATH}>
          {text.panelLink}
        </Link>
      </div>
    </section>
  );
}
