import { createRoot, type Root } from "react-dom/client";
import { ActivityHeatmap, type ActivityDatum } from "../components/ui/activity-heatmap";

const roots = new WeakMap<HTMLElement, Root>();
const number = new Intl.NumberFormat("pt-BR");

export function renderAnalyticsActivity(container: HTMLElement, timestamps: number[]) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  const byDay = new Map<string, ActivityDatum>();
  for (const timestamp of timestamps) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;
    const entry = byDay.get(key);
    if (entry) entry.value += 1;
    else byDay.set(key, { date: key, value: 1 });
  }

  root.render(
    <ActivityHeatmap
      data={[...byDay.values()]}
      cellSize={12}
      color="#4b9dff"
      unit="leads"
      formatValue={(value) => number.format(value)}
      autoPlay
      startPaused
    />,
  );
}
