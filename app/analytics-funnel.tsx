import { createRoot, type Root } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { FunnelChart, type FunnelStage } from "../components/ui/funnel-chart";

const roots = new WeakMap<HTMLElement, Root>();
const number = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent" });
const referenceWidths = [1, 2957 / 4100, 1084 / 4100, 1038 / 4100, 320 / 4100];

function getPreviewWidths(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const position = index * (referenceWidths.length - 1) / Math.max(count - 1, 1);
    const start = Math.floor(position);
    const end = Math.ceil(position);
    return referenceWidths[start] + (referenceWidths[end] - referenceWidths[start]) * (position - start);
  });
}

export function renderAnalyticsFunnel(container: HTMLElement, stages: FunnelStage[]) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  const data = stages.map((stage, index) => ({
    ...stage,
    gradient: [
      { offset: "0%", color: `var(--chart-${index % 5 + 1})` },
      { offset: "100%", color: `var(--chart-${(index + 1) % 5 + 1})` },
    ],
  }));
  const preview = stages.every((stage) => stage.value === 0);

  root.render(
    <MotionConfig reducedMotion="user">
      <FunnelChart
        className={preview ? "analytics-funnel-plot analytics-funnel-plot--preview" : "analytics-funnel-plot"}
        data={data}
        previewWidths={preview ? getPreviewWidths(data.length) : undefined}
        grid={false}
        layers={3}
        formatValue={(value) => number.format(value)}
        formatPercentage={(value) => preview ? "—" : percent.format(value / 100)}
        style={{ minWidth: data.length * 94 }}
      />
    </MotionConfig>,
  );
}
