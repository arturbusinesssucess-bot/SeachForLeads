import { fileURLToPath } from "node:url";
import { build } from "esbuild";

await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: {
    "analytics-funnel.v2": "app/analytics-funnel.tsx",
    "plans-pricing.v1": "app/plans-pricing.tsx",
    "app-sidebar.v1": "app/sidebar.ts",
  },
  outdir: "public",
  format: "esm",
  bundle: true,
  minify: true,
  jsx: "automatic",
  target: "es2020",
});
