// The site root sends each viewer to their own start page (ADR-0040): the
// owner to the application list, everyone else to the public health panel.
// The check runs before any streaming, so the redirect keeps its status.
import { redirect } from "next/navigation";

import { currentViewer } from "@/lib/load";
import { OWNER_HOME, PANEL_PATH } from "@/lib/paths";

export default async function Home() {
  redirect((await currentViewer()) === "owner" ? OWNER_HOME : PANEL_PATH);
}
