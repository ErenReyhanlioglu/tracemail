"use client";

// Waiting feedback for links that navigate (ADR-0049). A PendingNavigation
// groups controls whose clicks are answered at once: the clicked link shows
// as selected before the server answers, the group's content dims quietly
// when the answer is slow and is marked busy for screen readers, and after a
// new page of a list arrives focus moves to the list. Navigation runs in a
// transition, so of several quick clicks only the last one counts. Without
// JavaScript every link is a plain link.
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useEffect,
  useOptimistic,
  useRef,
  useTransition,
} from "react";

import styles from "./Pending.module.css";

export interface NavigateOptions {
  // Links in one group show one selection; a click moves it at once.
  group: string;
  scroll?: boolean;
  replace?: boolean;
  // A new page of the same list: focus moves to the list once it arrives.
  focusList?: boolean;
}

export type Navigate = (href: string, options: NavigateOptions) => void;

interface Target {
  group: string;
  href: string;
}

interface PendingValue {
  pending: boolean;
  target: Target | null;
  navigate: Navigate;
  content: RefObject<HTMLDivElement | null>;
}

const PendingContext = createContext<PendingValue | null>(null);

// The list's table takes focus without joining the tab order, so the next
// Tab reaches its first row. The scroll is left to the router.
function focusTable(content: HTMLDivElement | null): void {
  const table = content?.querySelector("table");
  if (!table) {
    return;
  }
  table.tabIndex = -1;
  table.focus({ preventScroll: true });
}

export function PendingNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useOptimistic<Target | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const focusList = useRef(false);

  function navigate(href: string, options: NavigateOptions): void {
    focusList.current = options.focusList ?? false;
    startTransition(() => {
      setTarget({ group: options.group, href });
      const go = options.replace ? router.replace : router.push;
      go(href, { scroll: options.scroll ?? true });
    });
  }

  useEffect(() => {
    if (!pending && focusList.current) {
      focusList.current = false;
      focusTable(content.current);
    }
  }, [pending]);

  return <PendingContext value={{ pending, target, navigate, content }}>{children}</PendingContext>;
}

// The href a group is navigating to, or null while it is not.
export function usePendingTarget(group: string): string | null {
  const target = use(PendingContext)?.target;
  return target?.group === group ? target.href : null;
}

// Navigation through the nearest group, or null outside one.
export function useNavigate(): Navigate | null {
  return use(PendingContext)?.navigate ?? null;
}

// What a navigation replaces: dims while it is slow, busy for screen readers.
export function PendingContent({ children }: { children: ReactNode }) {
  const value = use(PendingContext);
  const pending = value?.pending === true;
  return (
    <div
      ref={value?.content}
      className={styles.content}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
    >
      {children}
    </div>
  );
}

type PendingLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "className" | "onNavigate" | "aria-current"
> & {
  href: string;
  group: string;
  // CSS module classes, typed as possibly undefined.
  className: string | undefined;
  // Shown instead of className while the link is the group's selection.
  selectedClassName?: string | undefined;
  selected?: boolean;
  // The aria-current value while selected; none when omitted.
  current?: "page" | "true";
  focusList?: boolean;
};

export function PendingLink({
  href,
  group,
  className,
  selectedClassName,
  selected = false,
  current,
  focusList,
  scroll,
  replace,
  ...rest
}: PendingLinkProps) {
  const navigate = useNavigate();
  const target = usePendingTarget(group);
  const shown = target === null ? selected : target === href;
  return (
    <Link
      {...rest}
      href={href}
      scroll={scroll}
      replace={replace}
      className={shown && selectedClassName ? selectedClassName : className}
      aria-current={shown ? current : undefined}
      onNavigate={
        navigate
          ? (event) => {
              event.preventDefault();
              navigate(href, { group, scroll, replace, focusList });
            }
          : undefined
      }
    />
  );
}
