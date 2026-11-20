import { createRoot } from "react-dom/client";
import PricingSection from "../components/ui/pricing-section";

export function renderPlansPricing(host: HTMLElement) {
  createRoot(host).render(<PricingSection />);
}
