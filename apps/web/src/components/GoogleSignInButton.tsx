// The "Sign in with Google" link, built to Google's branding guidelines:
// the current G mark from Google's own assets (cropped, not altered), its
// light or dark theme to match the page, and Google Sans Medium, which is
// self-hosted at build time and loaded only where this button is used.
import { Google_Sans } from "next/font/google";
import Image from "next/image";

import darkLogo from "./brand/google-g-dark.png";
import lightLogo from "./brand/google-g-light.png";
import styles from "./GoogleSignInButton.module.css";

const googleSans = Google_Sans({ subsets: ["latin", "latin-ext"], weight: "500" });

export function GoogleSignInButton({ href, label }: { href: string; label: string }) {
  return (
    <a className={`${styles.button} ${googleSans.className}`} href={href}>
      {/* Decorative: the label names the action. A 5 KB fixed asset, so it
          skips the image optimizer. */}
      <Image className={`${styles.logo} ${styles.light}`} src={lightLogo} alt="" unoptimized />
      <Image className={`${styles.logo} ${styles.dark}`} src={darkLogo} alt="" unoptimized />
      {label}
    </a>
  );
}
