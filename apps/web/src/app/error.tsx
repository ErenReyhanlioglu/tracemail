"use client";

// Any unexpected error below the root layout: one page for all of them, with
// a retry (ADR-0039). Details stay in the server log; the browser receives
// only Next.js's error digest.
import Link from "next/link";

import { actionClass, CenteredPage } from "@/components/CenteredPage";
import { strings } from "@/lib/strings";

const text = strings.errorPage;

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <CenteredPage
      title={text.title}
      body={text.body}
      action={
        <button type="button" className={actionClass.primary} onClick={() => retry()}>
          {strings.states.retry}
        </button>
      }
      links={
        <Link className={actionClass.secondary} href="/">
          {strings.notFound.home}
        </Link>
      }
    />
  );
}
