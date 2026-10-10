// Root layout: fonts (self-hosted at build time), the theme chosen by the
// owner (or the system default), and the global tokens.
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { isTheme, THEME_COOKIE } from "@/lib/theme";
import { strings } from "@/lib/strings";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: strings.appName,
  referrer: "no-referrer",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(stored) ? stored : undefined;
  return (
    <html lang="tr" data-theme={theme} className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
