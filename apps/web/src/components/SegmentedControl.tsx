"use client";

// One choice from a few mutually exclusive options that filter a list, with
// a count per option (Primer's SegmentedControl, ADR-0042). Each option is a
// link, since the choice lives in the URL; the selected one is marked with
// aria-current and shown by background and weight together. A click moves
// the selection at once (ADR-0049): one raised background slides to the
// clicked option while the list loads. Before the script runs, and without
// it, the selected option draws its own background.
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

import { PendingLink, usePendingTarget } from "./navigation/Pending";
import styles from "./SegmentedControl.module.css";

export interface Segment {
  key: string;
  label: string;
  href: string;
  selected: boolean;
  count?: number;
}

// The raised background's place, measured from the shown option.
function boxOf(option: HTMLElement): CSSProperties {
  return {
    "--indicator-x": `${option.offsetLeft}px`,
    "--indicator-y": `${option.offsetTop}px`,
    "--indicator-width": `${option.offsetWidth}px`,
    "--indicator-height": `${option.offsetHeight}px`,
  } as CSSProperties;
}

function useIndicator(shown: string | undefined) {
  const list = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) {
      return undefined;
    }
    function measure(): void {
      const option = root?.querySelector<HTMLElement>(`[data-segment="${shown}"]`);
      setBox(option ? boxOf(option) : null);
    }
    measure();
    // Counts, fonts, and wrapping change the options' sizes.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll("a").forEach((option) => observer.observe(option));
    return () => observer.disconnect();
  }, [shown]);
  return { list, box };
}

export function SegmentedControl({
  label,
  group,
  segments,
}: {
  label: string;
  // The URL parameter the options set; one selection per group.
  group: string;
  segments: Segment[];
}) {
  const target = usePendingTarget(group);
  const shown = (segments.find((s) => s.href === target) ?? segments.find((s) => s.selected))?.key;
  const { list, box } = useIndicator(shown);
  return (
    <nav aria-label={label}>
      <ul ref={list} className={styles.control} data-indicator={box ? "" : undefined}>
        {box ? <li aria-hidden="true" className={styles.indicator} style={box} /> : null}
        {segments.map((segment) => (
          <li key={segment.key}>
            <PendingLink
              href={segment.href}
              group={group}
              data-segment={segment.key}
              className={styles.segment}
              selectedClassName={`${styles.segment} ${styles.selected}`}
              selected={segment.selected}
              current="page"
            >
              {segment.label}
              {segment.count === undefined ? null : (
                <span className={styles.count}>{segment.count}</span>
              )}
            </PendingLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
