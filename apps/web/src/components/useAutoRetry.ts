"use client";

// One failure card's own retry (ADR-0050): while active, it counts down and
// then calls the retry; the count restarts with each attempt, by hand or by
// itself, and pauses while one runs. Every card has its own, so one card's
// retry never moves another.
import { useCallback, useEffect, useState } from "react";

export const AUTO_RETRY_SECONDS = 30;
const SECOND_MS = 1000;

export function useAutoRetry(
  active: boolean,
  pending: boolean,
  retry: () => void,
): { left: number; attempt: () => void } {
  const [left, setLeft] = useState(AUTO_RETRY_SECONDS);

  const attempt = useCallback(() => {
    setLeft(AUTO_RETRY_SECONDS);
    retry();
  }, [retry]);

  useEffect(() => {
    if (!active || pending) {
      return undefined;
    }
    const timer = window.setTimeout(
      () => (left > 1 ? setLeft(left - 1) : attempt()),
      SECOND_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, left, pending, attempt]);

  return { left, attempt };
}
