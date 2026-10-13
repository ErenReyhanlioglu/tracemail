"use client";

// Fetches the page's server data again; disabled while the attempt runs, so
// the owner sees that something happened.
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { strings } from "@/lib/strings";

export function RetryButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? strings.states.retrying : strings.states.retry}
    </button>
  );
}
