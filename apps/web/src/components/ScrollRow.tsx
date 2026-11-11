"use client";

// A row that scrolls sideways (the phone's filter row, ADR-0052), brought
// to a changed menu on arrival and made usable with a mouse: its scrollbar is hidden, so the wheel scrolls it
// sideways while it can, and a mouse can drag it. Touch keeps the browser's
// own swipe. Once the row reaches an end the wheel scrolls the page again;
// a drag that moved does not count as a click on the tab it ends on.
import { type ReactNode, useEffect, useRef } from "react";

// A press that moves less than this is still a click.
const DRAG_THRESHOLD_PX = 4;

function overflows(row: HTMLElement): boolean {
  return row.scrollWidth > row.clientWidth;
}

function onWheel(row: HTMLElement, event: WheelEvent): void {
  if (!overflows(row) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    return;
  }
  const before = row.scrollLeft;
  row.scrollLeft += event.deltaY;
  if (row.scrollLeft !== before) {
    event.preventDefault();
  }
}

// After a drag, the click the release would fire is swallowed once.
function swallowNextClick(row: HTMLElement): void {
  const swallow = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  row.addEventListener("click", swallow, { capture: true, once: true });
  // If no click follows (released outside the row), drop the trap.
  setTimeout(() => row.removeEventListener("click", swallow, { capture: true }), 0);
}

function onPointerDown(row: HTMLElement, down: PointerEvent): void {
  if (down.pointerType !== "mouse" || down.button !== 0 || !overflows(row)) {
    return;
  }
  const startX = down.clientX;
  const startLeft = row.scrollLeft;
  let dragged = false;
  const move = (event: PointerEvent): void => {
    const dx = event.clientX - startX;
    if (!dragged && Math.abs(dx) < DRAG_THRESHOLD_PX) {
      return;
    }
    dragged = true;
    row.scrollLeft = startLeft - dx;
  };
  const up = (): void => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (dragged) {
      swallowNextClick(row);
    }
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

// On arrival, a menu away from its default (the period or the sort) is
// brought into the row's view, so a list ordered or narrowed off screen
// says why (ADR-0052).
function revealChanged(row: HTMLElement): void {
  const changed = row.querySelector<HTMLElement>("[data-changed]");
  if (!changed || !overflows(row)) {
    return;
  }
  const end = changed.offsetLeft + changed.offsetWidth - row.clientWidth;
  if (end > row.scrollLeft) {
    row.scrollLeft = end + Number.parseFloat(getComputedStyle(row).paddingRight);
  }
}

export function ScrollRow({
  className,
  children,
}: {
  className: string | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    if (!row) {
      return undefined;
    }
    revealChanged(row);
    const wheel = (event: WheelEvent): void => onWheel(row, event);
    const press = (event: PointerEvent): void => onPointerDown(row, event);
    // Not passive: the wheel's page scroll is cancelled while the row moves.
    row.addEventListener("wheel", wheel, { passive: false });
    row.addEventListener("pointerdown", press);
    return () => {
      row.removeEventListener("wheel", wheel);
      row.removeEventListener("pointerdown", press);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
