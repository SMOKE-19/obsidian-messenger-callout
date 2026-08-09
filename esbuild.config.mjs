import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copyFile, mkdir } from "node:fs/promises";

const prod = process.argv[2] === "production";
const context = await esbuild.context({
  banner: {
    js: "/* Generated bundle. Source: https://github.com/SMOKE-19/obsidian-messenger-callout */"
  },
  entryPoints: ["main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    ...builtins
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  loader: {
    ".yaml": "text",
    ".yml": "text"
  },
  outfile: prod ? "dist/messenger-callout/main.js" : "main.js",
  minify: prod
});

if (prod) {
  await mkdir("dist/messenger-callout/profiles", { recursive: true });
  await mkdir("dist/messenger-callout/assets", { recursive: true });
  await context.rebuild();
  await context.dispose();
  await Promise.all([
    copyFile("manifest.json", "dist/messenger-callout/manifest.json"),
    copyFile("styles.css", "dist/messenger-callout/styles.css"),
    copyFile("versions.json", "dist/messenger-callout/versions.json"),
    copyFile("profiles/example.yaml", "dist/messenger-callout/profiles/example.yaml"),
    copyFile("assets/messenger-tiles.svg", "dist/messenger-callout/assets/messenger-tiles.svg")
  ]);
} else {
  await context.watch();
}
