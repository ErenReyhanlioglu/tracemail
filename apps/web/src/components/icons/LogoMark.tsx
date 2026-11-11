// The TraceMail mark: an envelope whose flap lines join into one trace that
// ends in a dot. Lines take the text color; the dot takes --color-accent, so
// the mark follows the theme and the surface it sits on. Owner-provided
// artwork (docs/assets has the fixed-color versions). On the standalone
// pages the dot tells the page's state (ADR-0052): the accent as usual, a
// hollow grey ring where nothing arrived (404), red where delivery failed
// (500).
export type LogoDot = "accent" | "missing" | "failed";

const DOT_FILL: Record<LogoDot, string> = {
  accent: "var(--color-accent)",
  missing: "none",
  failed: "var(--color-error)",
};

export function LogoMark({ className, dot = "accent" }: { className?: string; dot?: LogoDot }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect
        x="3.5"
        y="3.25"
        width="25"
        height="15"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
      />
      <path
        d="M5 5.25 L16 12.5 L27 5.25 M16 12.5 V23.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="26.75"
        r={dot === "missing" ? 2.25 : 3}
        fill={DOT_FILL[dot]}
        stroke={dot === "missing" ? "var(--color-text-meta)" : "none"}
        strokeWidth="1.5"
      />
    </svg>
  );
}
