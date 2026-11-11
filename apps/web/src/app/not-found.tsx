// Every unknown address: a real 404 with a plain explanation and a way on
// (ADR-0039; v2 look, ADR-0052): the logo's dot a hollow ring, the strip
// ending in a missing record, the status and the asked path in mono, then
// the health panel and the sign-in.
import type { Metadata } from "next";
import Link from "next/link";

import { actionClass, CenteredPage } from "@/components/CenteredPage";
import { HealthIcon, SignInIcon } from "@/components/icons/NavIcons";
import { RequestedPath } from "@/components/RequestedPath";
import { LOGIN_PATH, PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

const text = strings.notFound;

export const metadata: Metadata = {
  title: strings.pageTitle(text.title),
};

export default function NotFound() {
  return (
    <CenteredPage
      title={text.title}
      body={text.body}
      dot="missing"
      strip="missing"
      code={
        <span>
          {text.status} · <RequestedPath />
        </span>
      }
      action={
        <Link className={actionClass.primary} href={PANEL_PATH}>
          <HealthIcon />
          {text.toPanel}
        </Link>
      }
      links={
        <Link className={actionClass.secondary} href={LOGIN_PATH}>
          <SignInIcon />
          {strings.account.signIn}
        </Link>
      }
    />
  );
}
