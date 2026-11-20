import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import PricingSection from "../components/ui/pricing-section";

export function renderPlansPricing(host: HTMLElement, surface: "app" | "landing" = "app") {
  const root = createRoot(host);
  const render = () => root.render(<PricingSection surface={surface} />);
  if (surface === "landing") flushSync(render);
  else render();
}
