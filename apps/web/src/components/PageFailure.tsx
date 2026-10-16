"use client";

// A page whose one part failed, such as a list (ADR-0050): its card retries
// by fetching the page's server data again, at once or when its count ends.
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import type { FailureReason } from "@/lib/failures";

import { FailureCard } from "./FailureCard";
import { useAutoRetry } from "./useAutoRetry";

export function PageFailure({ reason }: { reason: FailureReason }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  const { left, attempt } = useAutoRetry(true, pending, refresh);
  return <FailureCard reason={reason} left={left} pending={pending} onRetry={attempt} />;
}
