import { expect, type Page, type BrowserContext } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { resolve, extname, sep } from "node:path";
import { build } from "vite";
import { readFile } from "node:fs/promises";
import { png } from "./fixture";
let fixture: Promise<string> | undefined;
const offlineServers = new WeakMap<Page, Server>();
const staticReleases = new WeakMap<Page, { revision: number }>();
async function isolatedOrigin(page: Page, mount = "/") {
  const root = resolve("dist");
  const release = { revision: 0 };
  staticReleases.set(page, release);
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(mount)) {
      res.writeHead(404).end();
      return;
    }
    const pathname = url.pathname.slice(mount.length - 1);
    const path = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : decodeURIComponent(pathname)),
    );
    if (!path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      res.setHeader(
        "Content-Type",
        types[extname(path)] ?? "application/octet-stream",
      );
      const bytes = await readFile(path);
      // A byte-distinct static SW release lets tests exercise the real update
      // lifecycle without changing the app or its IndexedDB/OPFS schema.
      res.end(
        pathname === "/sw.js" && release.revision
          ? Buffer.concat([
              bytes,
              Buffer.from(`\n// Test static release ${release.revision}\n`),
            ])
          : bytes,
      );
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  offlineServers.set(page, server);
  page.once("close", () => server.close());
  return (
    "http://127.0.0.1:" +
    (server.address() as { port: number }).port +
    mount.slice(0, -1)
  );
}
export async function republish(page: Page) {
  const release = staticReleases.get(page);
  if (!release) throw new Error("Missing isolated static origin");
  release.revision++;
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.ready).update();
  });
}
export async function offline(
  page: Page,
  context: BrowserContext,
  browserName: string,
) {
  if (browserName !== "webkit") {
    await context.setOffline(true);
    return;
  }
  // Playwright #42775 rejects SW responses with setOffline(true). Stop the actual origin.
  const server = offlineServers.get(page);
  if (!server) throw new Error("Missing isolated offline origin");
  await new Promise<void>((resolve, reject) => {
    server.close((e) => (e ? reject(e) : resolve()));
    server.closeAllConnections();
  });
  await page.evaluate(() =>
    Object.defineProperty(Navigator.prototype, "onLine", {
      configurable: true,
      get: () => false,
    }),
  );
}
export async function inject(page: Page) {
  fixture ??= (async () => {
    await build({
      configFile: false,
      logLevel: "error",
      build: {
        outDir: "work/local-test-helper",
        emptyOutDir: false,
        minify: false,
        lib: {
          entry: "e2e/local-helper.ts",
          name: "LocalTest",
          formats: ["iife"],
          fileName: () => "helper.js",
        },
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
    });
    return readFile("work/local-test-helper/helper.js", "utf8");
  })();
  await page.addScriptTag({ content: await fixture });
}
export async function setup(page: Page, isolated = false, mount = "/") {
  page.on("pageerror", (error) => console.log("Browser error:", error.message));
  await page.goto(
    (isolated ? await isolatedOrigin(page, mount) : "") + "/#/home",
  );
  await page.getByLabel("4桁のPIN", { exact: true }).fill("1234");
  await page.getByLabel("PIN（確認）", { exact: true }).fill("1234");
  await page
    .getByRole("button", { name: "PINを設定して始める", exact: true })
    .click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
}
export async function unlock(page: Page) {
  await page.getByLabel("4桁のPIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "ロック解除", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
}
export async function createUI(page: Page, count = 1) {
  await page
    .getByRole("button", { name: "シリーズを作成", exact: true })
    .click();
  await page.getByLabel("Full Prompt", { exact: true }).fill("夜の街角の研究");
  await page.locator("input[type=file]").setInputFiles(
    Array.from({ length: count }, (_, n) => ({
      name: `original-${n}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "A-000", exact: true }),
  ).toBeVisible();
}
