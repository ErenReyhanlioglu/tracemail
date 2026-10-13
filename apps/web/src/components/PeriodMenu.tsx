"use client";

// The incoming-postings period as a menu drawn in the app's own style
// (ADR-0042): a button that shows the current period and opens a list of
// links (WAI-ARIA disclosure navigation). The native select's list could
// not be styled. The menu closes on Escape (focus returns to the button), on
// a click outside, when focus leaves it, and when a period is chosen.
import Link from "next/link";
import { type FocusEvent, useEffect, useId, useRef, useState } from "react";

import { CheckIcon, ChevronDownIcon, ClockIcon } from "./icons/NavIcons";
import styles from "./ListPanel.module.css";

export interface MenuOption {
  key: string;
  label: string;
  href: string;
  selected: boolean;
}

export function PeriodMenu({ label, options }: { label: string; options: MenuOption[] }) {
  const [open, setOpen] = useState(false);
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
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!root.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }

  const current = options.find((option) => option.selected);
  return (
    <div ref={root} className={styles.menu} onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
      >
        <ClockIcon />
        <span className="visually-hidden">{label}: </span>
        {current?.label}
        <ChevronDownIcon />
      </button>
      <ul id={listId} className={styles.menuList} hidden={!open}>
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={option.href}
              scroll={false}
              className={styles.menuItem}
              aria-current={option.selected ? "true" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className={styles.menuCheck}>{option.selected ? <CheckIcon /> : null}</span>
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
