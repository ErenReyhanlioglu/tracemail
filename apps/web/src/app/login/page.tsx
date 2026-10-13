// Login: a single link into the API's Google Sign-In (ADR-0015). The page
// holds no authentication logic; the API sets the session, or sends the
// browser back here with a reason this page explains (ADR-0040). Only the
// owner can sign in and there is no sign-up, which the page says up front.
import type { Metadata } from "next";
import Link from "next/link";

import { actionClass, CenteredPage } from "@/components/CenteredPage";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

const GOOGLE_LOGIN_URL = "/api/v1/auth/google/login";
const text = strings.login;

export const metadata: Metadata = { title: strings.pageTitle(strings.account.signIn) };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <CenteredPage
      title={text.title}
      notice={error ? text.errors[error] : undefined}
      action={<GoogleSignInButton href={GOOGLE_LOGIN_URL} label={text.google} />}
      footnote={text.footnote}
      links={
        <Link className={actionClass.secondary} href={PANEL_PATH}>
          {text.backToPanel}
        </Link>
      }
    />
  );
}
