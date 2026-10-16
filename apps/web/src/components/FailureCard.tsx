// What a part of a page shows when the API gave it no data (ADR-0050): what
// failed, as far as the web can tell, when the card tries again by itself,
// and a button to try at once. Kept short and calm: one line says what
// happened, one line what happens next. The retry belongs to the card's
// owner, so each card retries only its own part.
import type { FailureReason } from "@/lib/failures";
import { strings } from "@/lib/strings";

import styles from "./FailureCard.module.css";
import { RetryIcon, SpinnerIcon, WarningIcon } from "./icons/NavIcons";

const text = strings.states;

export function FailureCard({
  reason,
  left,
  pending,
  onRetry,
}: {
  reason: FailureReason;
  // Seconds until the card tries again by itself.
  left: number;
  pending: boolean;
  onRetry: () => void;
}) {
  return (
    <div className={styles.card}>
      <span className={styles.warning}>
        <WarningIcon />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{text.failures[reason]}</p>
        <p className={styles.detail}>
          {pending ? (
            text.retryingNow
          ) : (
            <>
              <span className={styles.number}>{left}</span> {text.autoRetrySeconds}
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        className={pending ? `${styles.button} ${styles.pending}` : styles.button}
        disabled={pending}
        onClick={onRetry}
      >
        {pending ? <SpinnerIcon /> : <RetryIcon />}
        {pending ? text.retrying : text.retry}
      </button>
    </div>
  );
}
