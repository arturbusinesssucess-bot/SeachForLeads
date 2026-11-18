import { fileURLToPath } from "node:url";
import { build } from "esbuild";

await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["app/analytics-funnel.tsx"],
  outfile: "public/analytics-funnel.v2.js",
  format: "esm",
  bundle: true,
  minify: true,
  jsx: "automatic",
  target: "es2020",
});
