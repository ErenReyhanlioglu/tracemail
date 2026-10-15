"use client";

// Ends the session through the API, then returns to the public health panel
// (ADR-0040). Styled by its place (sidebar footer or the phone's top bar);
// where only its icon shows, the label stays readable.
import { useRouter } from "next/navigation";

import { PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

import { SignOutIcon } from "../icons/NavIcons";

const LOGOUT_URL = "/api/v1/auth/logout";

export function SignOutButton({
  className,
  labelClassName,
}: {
  className?: string;
  labelClassName?: string;
}) {
  const router = useRouter();

  async function signOut(): Promise<void> {
    await fetch(LOGOUT_URL, { method: "POST" });
    router.push(PANEL_PATH);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={className}
      title={strings.account.signOut}
      onClick={() => void signOut()}
    >
      <SignOutIcon />
      <span className={labelClassName}>{strings.account.signOut}</span>
    </button>
  );
}
