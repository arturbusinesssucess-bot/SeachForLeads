import { createRoot } from "react-dom/client";
import { ProgressiveFluxLoader, type FluxProgress } from "../components/ui/progressive-flux-loader";

export function mountSearchFluxLoader(host: HTMLElement, initial: FluxProgress) {
  const root = createRoot(host);
  const update = (progress: FluxProgress) => root.render(<ProgressiveFluxLoader {...progress} />);
  update(initial);
  return { update, unmount: () => root.unmount() };
}
