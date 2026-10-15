// Root layout: fonts (self-hosted at build time), the theme and sidebar
// width chosen by the viewer (or the defaults), and the global tokens.
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { PressFeedback } from "@/components/shell/PressFeedback";
import { isCollapsed, SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/sidebar";
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
  description: strings.appDescription,
  referrer: "no-referrer",
};

// "cover" lets the page reach the screen's edges, so the bottom bar can pad
// itself for the iPhone's home indicator (ADR-0047).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const stored = jar.get(THEME_COOKIE)?.value;
  const theme = isTheme(stored) ? stored : undefined;
  const sidebar = isCollapsed(jar.get(SIDEBAR_COOKIE)?.value) ? SIDEBAR_COLLAPSED : undefined;
  return (
    <html
      lang="tr"
      data-theme={theme}
      data-sidebar={sidebar}
      className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <PressFeedback />
        {children}
      </body>
    </html>
  );
}
