// Named media queries (ADR-0047), as GitHub's Primer does: global-data
// prepends the definitions in src/app/media.css to every CSS file (CSS
// Modules are compiled one file at a time), and custom-media replaces each
// `@media (--name)` with its query. Turbopack then hands the result to
// Lightning CSS as before. The path is absolute because `just web` starts
// Next.js from the repository root.
import { fileURLToPath } from "node:url";

const media = fileURLToPath(new URL("./src/app/media.css", import.meta.url));

const config = {
  plugins: {
    "@csstools/postcss-global-data": { files: [media] },
    "postcss-custom-media": { preserve: false },
  },
};

export default config;
