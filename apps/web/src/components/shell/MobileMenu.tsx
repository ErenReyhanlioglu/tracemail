"use client";

// The phone's menu (ADR-0052): a button in the top bar that opens a sheet
// from the bottom with what the sidebar holds beyond the five sections (the
// viewer, the theme, the quick views, the developer links, signing in or
// out). A modal <dialog>: focus stays inside, Escape closes it, the page
// behind dims. A tap on the dimmed page or on a link inside closes it too.
import { type MouseEvent, type ReactNode, useRef } from "react";

import { strings } from "@/lib/strings";

import { MenuIcon } from "../icons/NavIcons";
import styles from "./MobileMenu.module.css";

const text = strings.nav;

export function MobileMenu({
  buttonClassName,
  children,
}: {
  buttonClassName: string | undefined;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  function onClick(event: MouseEvent<HTMLDialogElement>): void {
    const target = event.target as Element;
    // The dialog itself is the target only on its backdrop.
    if (target === dialog.current || target.closest("a")) {
      dialog.current?.close();
    }
  }

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        aria-haspopup="dialog"
        title={text.openMenu}
        onClick={() => dialog.current?.showModal()}
      >
        <MenuIcon />
        <span className="visually-hidden">{text.openMenu}</span>
      </button>
      <dialog ref={dialog} className={styles.sheet} aria-label={text.menu} onClick={onClick}>
        <div className={styles.handle} aria-hidden="true" />
        <button
          type="button"
          className="visually-hidden"
          onClick={() => dialog.current?.close()}
        >
          {text.closeMenu}
        </button>
        <div className={styles.body}>{children}</div>
      </dialog>
    </>
  );
}
