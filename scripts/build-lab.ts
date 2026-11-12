// Bundles Lab into one HTML file, dist/lab.html, for publishing as an Artifact page (spec "Lab", D-005).
// The file is a page fragment: the Artifact host wraps it in <!doctype html><html><head>…<body>.
// Later slices inline models/lab/*.json here when they exist.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const js = await build({
  entryPoints: [new URL("src/lab/main.ts", root).pathname],
  bundle: true, write: false, format: "iife", target: "es2022", minify: true, legalComments: "none",
});
const css = readFileSync(new URL("src/lab/lab.css", root), "utf8");
const code = js.outputFiles[0].text.replaceAll("</script", "<\\/script");
const html = `<title>Phobos Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
${css}</style>
<main class="lab" id="app"></main>
<script>${code}</script>
`;
mkdirSync(new URL("dist/", root), { recursive: true });
writeFileSync(new URL("dist/lab.html", root), html);
console.log(`build-lab: dist/lab.html ${html.length} bytes`);
