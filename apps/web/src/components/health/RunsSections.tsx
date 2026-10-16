// The sections drawn from the run records (ADR-0050): the status line, the
// stages, and the history strips. Drawn by the server, or by the browser
// once a failed part has been read again.
import type { RunsPanel } from "@/lib/panel";

import { History } from "./History";
import { StageTable } from "./StageTable";
import { StatusLine } from "./StatusLine";

export function RunsSections({
  panel,
  now,
  version,
}: {
  panel: RunsPanel;
  now: Date;
  version: string | null;
}) {
  return (
    <>
      <StatusLine panel={panel} now={now} version={version} />
      <StageTable panel={panel} />
      <History panel={panel} />
    </>
  );
}
