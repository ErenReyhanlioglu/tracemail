"use client";

// The incoming-postings period as a menu drawn in the app's own style
// (ADR-0042): a button that shows the current period and opens a list of
// links (WAI-ARIA disclosure navigation). The native select's list could
// not be styled. The menu closes on Escape (focus returns to the button), on
// a click outside, when focus leaves it, and when a period is chosen. On
// phones the button sits in a sideways-scrolling row that would cut the
// list off, so the list is placed under the button from its measured
// position (ADR-0047) and closes when anything scrolls. A chosen period shows
// in the button at once, while the list loads (ADR-0049).
import {
  type CSSProperties,
  type FocusEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { CheckIcon, ChevronDownIcon, ClockIcon } from "./icons/NavIcons";
import styles from "./ListPanel.module.css";
import { PendingLink, usePendingTarget } from "./navigation/Pending";

export interface MenuOption {
  key: string;
  label: string;
  href: string;
  selected: boolean;
}

const GAP_PX = 4;
const GROUP = "period";

// Where the list goes: under the button, right edges aligned.
function placeUnder(button: HTMLButtonElement | null): CSSProperties {
  if (!button) {
    return {};
  }
  const box = button.getBoundingClientRect();
  return {
    "--menu-top": `${box.bottom + GAP_PX}px`,
    "--menu-right": `${document.documentElement.clientWidth - box.right}px`,
  } as CSSProperties;
}

export function PeriodMenu({
  label,
  options,
  active,
}: {
  label: string;
  options: MenuOption[];
  // A period narrows the list: the button shows it in the accent colour.
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onPointerDown(event: PointerEvent): void {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    function close(): void {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Capture, so scrolling the filter row closes it too.
    document.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function onBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!root.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }

  const target = usePendingTarget(GROUP);
  const current =
    options.find((option) => option.href === target) ?? options.find((option) => option.selected);
  return (
    <div ref={root} className={styles.menu} onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        className={active ? `${styles.menuButton} ${styles.menuButtonActive}` : styles.menuButton}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setPlace(placeUnder(button.current));
          setOpen(!open);
        }}
      >
        <ClockIcon />
        <span className="visually-hidden">{label}: </span>
        {current?.label}
        <ChevronDownIcon />
      </button>
      <ul id={listId} className={styles.menuList} style={place} hidden={!open}>
        {options.map((option) => (
          <li key={option.key}>
            <PendingLink
              href={option.href}
              group={GROUP}
              scroll={false}
              className={styles.menuItem}
              selected={option.selected}
              current="true"
              onClick={() => setOpen(false)}
            >
              <span className={styles.menuCheck}>{option === current ? <CheckIcon /> : null}</span>
              {option.label}
            </PendingLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
