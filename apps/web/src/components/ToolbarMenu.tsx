"use client";

// A list toolbar's menu drawn in the app's own style (ADR-0042; the period
// and, since ADR-0052, the sort): a button that shows the current choice
// and opens a list of links (WAI-ARIA disclosure navigation). The native
// select's list could not be styled. The menu closes on Escape (focus
// returns to the button), on a click outside, when focus leaves it, and when
// a choice is made. On phones the button sits in a sideways-scrolling row
// that would cut the list off, so the list is placed under the button from
// its measured position (ADR-0047) and closes when anything scrolls. A
// chosen option shows in the button at once, while the list loads
// (ADR-0049). An option without an address cannot be chosen yet.
import {
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { strings } from "@/lib/strings";

import { CheckIcon, ChevronDownIcon, CloseIcon } from "./icons/NavIcons";
import styles from "./ListPanel.module.css";
import { PendingLink, usePendingTarget } from "./navigation/Pending";

export interface MenuOption {
  key: string;
  label: string;
  // The button's shorter name, where the menu's is long.
  short?: string;
  // None: shown, but not yet a choice.
  href: string | null;
  selected: boolean;
}

const GAP_PX = 4;

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

function Item({
  option,
  shown,
  group,
  onChoose,
}: {
  option: MenuOption;
  shown: boolean;
  group: string;
  onChoose: () => void;
}) {
  const check = <span className={styles.menuCheck}>{shown ? <CheckIcon /> : null}</span>;
  if (option.href === null) {
    return (
      <span className={`${styles.menuItem} ${styles.menuItemDisabled}`} aria-disabled="true">
        {check}
        {option.label}
        <span className="visually-hidden">, {strings.nav.comingLater}</span>
      </span>
    );
  }
  return (
    <PendingLink
      href={option.href}
      group={group}
      scroll={false}
      className={styles.menuItem}
      selected={option.selected}
      current="true"
      onClick={onChoose}
    >
      {check}
      {option.label}
    </PendingLink>
  );
}

export function ToolbarMenu({
  label,
  group,
  icon,
  heading,
  options,
  reset,
}: {
  label: string;
  // The pending-navigation group, one per menu.
  group: string;
  icon: ReactNode;
  // A title over the list's options.
  heading?: string;
  options: MenuOption[];
  // The default period and the way back to it (wide screens, ADR-0052):
  // away from it, the menu is underlined like a selected tab and a cross
  // returns to it. Judged from the shown period, so a click marks it at
  // once, as the tabs do.
  reset?: { key: string; href: string; label: string };
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

  const target = usePendingTarget(group);
  // Only an option with an address can be the one loading: one that cannot
  // be chosen yet has none, and must never match an empty target.
  const loading = options.find((option) => option.href !== null && option.href === target);
  const current = loading ?? options.find((option) => option.selected);
  const changed = reset !== undefined && current !== undefined && current.key !== reset.key;
  return (
    <div
      ref={root}
      className={changed ? `${styles.menu} ${styles.menuChanged}` : styles.menu}
      // Phones scroll their filter row to a changed menu on arrival
      // (ScrollRow).
      data-changed={changed || undefined}
      onBlur={onBlur}
    >
      <button
        ref={button}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setPlace(placeUnder(button.current));
          setOpen(!open);
        }}
      >
        {icon}
        <span className="visually-hidden">{label}: </span>
        {current?.short ?? current?.label}
        <ChevronDownIcon />
      </button>
      {reset && changed ? (
        <PendingLink
          href={reset.href}
          group={group}
          scroll={false}
          className={styles.menuReset}
          aria-label={reset.label}
          title={reset.label}
        >
          <CloseIcon />
        </PendingLink>
      ) : null}
      <ul
        id={listId}
        className={styles.menuList}
        style={place}
        hidden={!open}
        aria-label={heading ?? label}
      >
        {heading ? (
          <li className={styles.menuHeading} aria-hidden="true">
            {heading}
          </li>
        ) : null}
        {options.map((option) => (
          <li key={option.key}>
            <Item
              option={option}
              shown={option === current}
              group={group}
              onChoose={() => setOpen(false)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
