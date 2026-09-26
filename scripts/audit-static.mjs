import { readFile, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { log } from "node:console";

const root = resolve(import.meta.dirname, "..");
async function files(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(
      !entry.isSymbolicLink(),
      `Unexpected symlink: ${prefix}${entry.name}`,
    );
    const name = prefix + entry.name;
    if (entry.isDirectory())
      result.push(...(await files(resolve(directory, entry.name), name + "/")));
    else result.push(name);
  }
  return result;
}
const read = (path) => readFile(resolve(root, path), "utf8");
const output = await files(resolve(root, "dist"));
for (const required of [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
])
  assert(output.includes(required), `Missing PWA file: ${required}`);
for (const name of output) {
  assert(
    /^(assets\/[^/]+\.(js|css|woff2)|index\.html|manifest\.webmanifest|sw\.js|workbox-[\w-]+\.js|(?:apple-touch-icon|icon-192|icon-512)\.png|icon\.svg)$/.test(
      name,
    ),
    `Non-app file in deployment: ${name}`,
  );
  if (![".js", ".html", ".css", ".webmanifest"].includes(extname(name)))
    continue;
  const text = await read("dist/" + name);
  assert(
    !/(?:cloudflare:|@cloudflare\/|workers\.dev|D1Database|R2Bucket|wrangler|google-analytics|googletagmanager|api\.openai|api\.stripe|["'`]\/api\b)/i.test(
      text,
    ),
    `Forbidden runtime or endpoint: ${name}`,
  );
  assert(!/sk-proj-[\w-]{20,}/.test(text), `Secret in deployment: ${name}`);
}
// Workbox may fetch app assets. Application code must not transmit user data.
for (const name of await files(resolve(root, "src"))) {
  if (!/\.[jt]sx?$/.test(name)) continue;
  const text = await read("src/" + name);
  assert(
    !/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\()/.test(
      text,
    ),
    `Network API in application source: ${name}`,
  );
}
const manifest = JSON.parse(await read("dist/manifest.webmanifest"));
for (const key of ["id", "scope", "start_url"])
  assert.equal(manifest[key], "./");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.lang, "ja");
for (const icon of manifest.icons) {
  assert(!/^(?:\/|[a-z]+:)/i.test(icon.src), "Icon must be relative");
  assert(output.includes(icon.src), `Missing icon: ${icon.src}`);
}
const html = await read("dist/index.html");
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert(url.startsWith("./"), `Non-relative app asset: ${url}`);
  assert(output.includes(url.slice(2)), `Missing app asset: ${url}`);
}
const pkg = JSON.parse(await read("package.json"));
assert(
  !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) =>
    /cloudflare|wrangler|workerd|stripe|analytics|openai/i.test(name),
  ),
  "Forbidden dependency",
);
log(
  `Static audit passed: ${output.length} app files; relative assets, scoped manifest, no application network APIs or cloud runtime signatures.`,
);
