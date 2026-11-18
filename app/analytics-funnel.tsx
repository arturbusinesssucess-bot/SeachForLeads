import { createRoot, type Root } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { FunnelChart, type FunnelStage } from "../components/ui/funnel-chart";

const roots = new WeakMap<HTMLElement, Root>();
const number = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent" });

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

  root.render(
    <MotionConfig reducedMotion="user">
      <FunnelChart
        className="analytics-funnel-plot"
        data={data}
        grid={false}
        layers={3}
        formatValue={(value) => number.format(value)}
        formatPercentage={(value) => percent.format(value / 100)}
        style={{ minWidth: data.length * 94 }}
      />
    </MotionConfig>,
  );
}
