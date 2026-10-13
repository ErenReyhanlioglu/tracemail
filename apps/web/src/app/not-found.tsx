// Every unknown address: a real 404 with a plain explanation and one way on
// (ADR-0039, after GOV.UK's "page not found" pattern).
import type { Metadata } from "next";
import Link from "next/link";

import { actionClass, CenteredPage } from "@/components/CenteredPage";
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
      action={
        <Link className={actionClass.primary} href="/">
          {text.home}
        </Link>
      }
    />
  );
}
