// What each health panel part shows while it loads (ADR-0050): the
// sections' real headings and a placeholder card at the block's measured
// height, so nothing moves when the data arrives. As in the lists'
// skeleton (ADR-0039), the placeholders stay hidden for --skeleton-delay,
// so a fast answer never flashes them, and their pulse stops under reduced
// motion. Screen readers hear one status message instead.
import { strings } from "@/lib/strings";

import styles from "./HealthPanel.module.css";
import skeleton from "./PanelSkeleton.module.css";

const text = strings.health;

// Placeholder lines per card, wide to narrow, as the sections' rows read.
const LINE_WIDTHS = [skeleton.wide, skeleton.medium, skeleton.wider, skeleton.narrow];

function Lines({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, line) => (
        <span key={line} className={`${skeleton.bar} ${LINE_WIDTHS[line % LINE_WIDTHS.length]}`} />
      ))}
    </>
  );
}

function SectionSkeleton({
  title,
  aside,
  height,
  lines,
}: {
  title: string;
  aside?: string;
  // The block's height class.
  height: string | undefined;
  lines: number;
}) {
  return (
    <div className={`${skeleton.part} ${height ?? ""}`}>
      <div className={styles.head}>
        <span className={styles.heading}>{title}</span>
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      <div className={`${styles.card} ${skeleton.card}`}>
        <Lines count={lines} />
      </div>
    </div>
  );
}

export function RunsSkeleton() {
  return (
    <div role="status" className={skeleton.group}>
      <span className="visually-hidden">{text.loading}</span>
      <div aria-hidden="true" className={skeleton.group}>
        <div className={`${skeleton.status} ${skeleton.statusHeight}`}>
          <Lines count={1} />
        </div>
        <SectionSkeleton
          title={text.stages.title}
          aside={text.stages.aside}
          height={skeleton.stagesHeight}
          lines={6}
        />
        <SectionSkeleton title={text.history.title} height={skeleton.historyHeight} lines={4} />
      </div>
    </div>
  );
}

export function ResourcesSkeleton() {
  return (
    <div aria-hidden="true">
      <SectionSkeleton title={text.resources.title} height={skeleton.resourcesHeight} lines={5} />
    </div>
  );
}

export function DeliverySkeleton() {
  return (
    <div aria-hidden="true">
      <SectionSkeleton
        title={text.delivery.title}
        aside={text.delivery.aside}
        height={skeleton.deliveryHeight}
        lines={8}
      />
    </div>
  );
}
