"use client";

// Free-text search of a list by title or company (ADR-0042). It searches as
// the owner types, after a short pause, and at once on Enter; the query
// lives in the URL like every other filter, and the history entry is
// replaced rather than added per keystroke. Without JavaScript it is a
// plain GET form. The list's other filters ride along; paging restarts.
// While results load, the list dims as for any other filter (ADR-0049).
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

import { MAX_QUERY_LENGTH, SEARCH_DEBOUNCE_MS, SEARCH_PARAM } from "@/lib/search";
import { strings } from "@/lib/strings";

import { SearchIcon } from "./icons/NavIcons";
import styles from "./ListPanel.module.css";
import { useNavigate } from "./navigation/Pending";

export function SearchBox({
  path,
  query,
  keep,
  placeholder,
}: {
  path: string;
  query: string;
  keep: Record<string, string>;
  placeholder: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const [value, setValue] = useState(query);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // The URL's query changed. While the field has focus the owner is typing
  // and the change is their own search arriving, possibly behind what they
  // typed since, so the field keeps their text; otherwise the change came
  // from elsewhere (a "clear" link) and the field shows it.
  useEffect(() => {
    if (document.activeElement !== input.current) {
      setValue(query);
    }
  }, [query]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function search(text: string): void {
    const trimmed = text.trim();
    const params = new URLSearchParams(keep);
    if (trimmed) {
      params.set(SEARCH_PARAM, trimmed);
    }
    const address = params.size > 0 ? `${path}?${params.toString()}` : path;
    if (navigate) {
      navigate(address, { group: "search", replace: true, scroll: false });
    } else {
      router.replace(address, { scroll: false });
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>): void {
    const text = event.target.value;
    setValue(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => search(text), SEARCH_DEBOUNCE_MS);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    window.clearTimeout(timer.current);
    search(value);
  }

  return (
    <form action={path} role="search" className={styles.search} onSubmit={onSubmit}>
      {Object.entries(keep).map(([name, field]) => (
        <input key={name} type="hidden" name={name} value={field} />
      ))}
      <SearchIcon />
      <label className="visually-hidden" htmlFor="list-search">
        {strings.search.label}
      </label>
      <input
        ref={input}
        id="list-search"
        type="search"
        name={SEARCH_PARAM}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={MAX_QUERY_LENGTH}
        autoComplete="off"
        className={styles.searchInput}
      />
    </form>
  );
}
