// Bundles Lab into one HTML file, dist/lab.html, for publishing as an Artifact page (spec "Lab", D-005).
// The file is a page fragment: the Artifact host wraps it in <!doctype html><html><head>…<body>.
// When models/lab/weights.json exists, models/lab/*.json are inlined as __LAB_MODELS__ and the Net tab is built;
// without it __LAB_MODELS__ is null, esbuild drops the Net code, and the page has no Net panel (J4).
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
export const MODELS_DIR = new URL("models/lab/", root);

/** models/lab/<name>.json keyed by name ("weights", "log", ...), or null when there is no weights.json. */
export function readModels(dir: URL): Record<string, unknown> | null {
  if (!existsSync(new URL("weights.json", dir))) return null;
  const out: Record<string, unknown> = {};
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort())
    out[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  return out;
}

export async function buildLabHtml(modelsDir: URL = MODELS_DIR): Promise<string> {
  const models = readModels(modelsDir);
  const js = await build({
    entryPoints: [fileURLToPath(new URL("src/lab/main.ts", root))],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2022",
    minify: true,
    legalComments: "none",
    define: { __LAB_MODELS__: JSON.stringify(models) },
  });
  const css = readFileSync(new URL("src/lab/lab.css", root), "utf8");
  const code = js.outputFiles[0].text.replaceAll("</script", "<\\/script");
  return `<title>Phobos Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
${css}</style>
<main class="lab" id="app"></main>
<script>${code}</script>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = await buildLabHtml();
  mkdirSync(new URL("dist/", root), { recursive: true });
  writeFileSync(new URL("dist/lab.html", root), html);
  console.log(
    `build-lab: dist/lab.html ${html.length} bytes${readModels(MODELS_DIR) ? ", with models/lab/" : ", no models/lab/"}`,
  );
}
