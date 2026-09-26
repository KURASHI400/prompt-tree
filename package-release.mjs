import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import process from "node:process";
import { zipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(process.argv[2] ?? join(root, "work", "release"));
const source = {};
const built = {};
async function collect(folder, target, prefix = "") {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const key = prefix + entry.name;
    if (entry.isDirectory())
      await collect(join(folder, entry.name), target, key + "/");
    else if (entry.isFile())
      target[key] = new Uint8Array(await readFile(join(folder, entry.name)));
  }
}
for (const directory of [
  ".github",
  "src",
  "public",
  "docs",
  "tests",
  "e2e",
  "scripts",
])
  await collect(join(root, directory), source, directory + "/");
for (const file of [
  "README.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
  ".gitignore",
  "index.html",
  "tsconfig.json",
  "eslint.config.js",
  "vite.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
])
  source[file] = new Uint8Array(await readFile(join(root, file)));
await collect(join(root, "dist"), built);
if (!built["index.html"] || !built["sw.js"])
  throw new Error("Run the production build before packaging.");
if (
  Object.keys(source).some((path) =>
    /(^|\/)(\.env[^/]*|\.dev\.vars|node_modules|work|\.wrangler|\.git)(\/|$)/.test(
      path,
    ),
  )
)
  throw new Error("Private or generated content found in release inputs.");
await mkdir(output, { recursive: true });
const checksums = [];
for (const [name, contents] of [
  ["PromptTree-v4-source.zip", source],
  ["PromptTree-v4-static.zip", built],
]) {
  const bytes = zipSync(contents, { level: 6 });
  await writeFile(join(output, name), bytes);
  checksums.push(
    `${createHash("sha256").update(bytes).digest("hex")}  ${name}`,
  );
  process.stdout.write(
    `${name}: ${Object.keys(contents).length} files, ${bytes.length} bytes\n`,
  );
}
await writeFile(
  join(output, "PromptTree-v4-SHA256.txt"),
  checksums.join("\n") + "\n",
);
