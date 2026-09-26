import { test, expect } from "@playwright/test";
import { setup, createUI, unlock, offline, republish } from "./local-fixture";

test("Pages project path: UI lifecycle, local writes, backup, deep links and offline cold reload", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90000);
  const requests: { url: string; method: string; type: string }[] = [];
  const errors: string[] = [];
  context.on("request", (request) => {
    if (/^https?:/.test(request.url()))
      requests.push({
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
      });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  // The server has no SPA rewrite and returns 404 outside this project mount.
  await setup(page, true, "/Prompt-Tree-v4/");
  const base = new URL("./", page.url()).href;
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    )
    .toBe(base + "sw.js");
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  expect(scope).toBe(base);
  const manifestLink = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const manifestURL = new URL(manifestLink!, base).href;
  const manifestResponse = await context.request.get(manifestURL);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  for (const key of ["id", "scope", "start_url"])
    expect(new URL(manifest[key], manifestURL).href).toBe(base);
  for (const icon of manifest.icons)
    expect(
      (await context.request.get(new URL(icon.src, manifestURL).href)).ok(),
    ).toBe(true);

  await createUI(page, 2);
  await page.getByRole("link", { name: "ツリー", exact: true }).click();
  await page.getByRole("button", { name: "A-000", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  const pane = await page.locator(".react-flow__pane").boundingBox();
  await page.mouse.move(pane!.x + 20, pane!.y + 180);
  await page.mouse.down();
  await page.mouse.move(pane!.x + 60, pane!.y + 210, { steps: 5 });
  await page.mouse.up();
  const viewport = page.locator(".react-flow__viewport");
  const position = await viewport.getAttribute("style");
  await page.locator(".react-flow__node").click();
  await expect(page.getByRole("dialog", { name: "カード詳細" })).toBeVisible();
  await page.getByRole("button", { name: "← 戻る" }).click();
  expect(await viewport.getAttribute("style")).toBe(position);
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollTop,
      document.body.scrollTop,
    ]),
  ).toEqual([0, 0]);
  await page.getByRole("link", { name: "画像", exact: true }).click();
  await expect(page.getByTestId("image-cell")).toHaveCount(2);
  await page.getByTestId("image-cell").first().click();
  await page.getByRole("button", { name: "♡", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "♥", exact: true }),
  ).toBeVisible();
  await page.locator(".pswp__button--close").click();
  await page.getByRole("link", { name: "検索", exact: true }).click();
  await page.getByRole("searchbox").fill("街角");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.getByRole("link", { name: "設定", exact: true }).click();
  await expect(page.getByText(/1 Cards · 2 Originals/)).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    }),
  );
  await page
    .getByRole("button", { name: "完全バックアップを作成", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "このPartを保存", exact: true })
    .click();
  const backup = await downloaded;
  await page
    .getByRole("button", { name: "全Partの保存を確認・完了", exact: true })
    .click();
  page.on("dialog", (dialog) => void dialog.accept());
  await page
    .getByLabel("バックアップから復元")
    .setInputFiles((await backup.path())!);
  await expect(page.getByText("復元しました", { exact: true })).toBeVisible();
  // A new app-shell Service Worker must retain the local PIN and restored data.
  await republish(page);
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await unlock(page);
  await expect(page.getByText(/1 Cards · 2 Originals/)).toBeVisible();
  // Restore intentionally creates new IDs in a new local workspace.
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "A-000", exact: true }).click();
  await expect(page.getByText("夜の街角の研究", { exact: true })).toBeVisible();
  const detailURL = page.url();
  // A direct Detail URL must work on a plain static host with no rewrite rule.
  await page.goto("about:blank");
  const direct = await page.goto(detailURL);
  expect(direct?.status()).toBe(200);
  await unlock(page);
  await expect(page.getByRole("dialog", { name: "カード詳細" })).toBeVisible();
  await expect(page.getByText("夜の街角の研究", { exact: true })).toBeVisible();
  await offline(page, context, browserName);
  await page.reload();
  await unlock(page);
  await expect(page.getByRole("dialog", { name: "カード詳細" })).toBeVisible();
  await page
    .getByRole("button", { name: "画像 1 を表示", exact: true })
    .click();
  await expect(page.locator(".pswp__img").first()).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page.locator(".pswp__button--close").click();
  await page.getByRole("button", { name: "← 戻る" }).click();
  await page.getByRole("link", { name: "画像", exact: true }).click();
  await expect(page.getByTestId("image-cell")).toHaveCount(2);
  const favorite = page.getByRole("button", { name: /^画像 \d+ お気に入り$/ });
  await expect(favorite).toHaveCount(1);
  await favorite.click();
  await expect(
    page.getByRole("button", { name: "♥", exact: true }),
  ).toBeVisible();
  await page.locator(".pswp__button--close").click();

  expect(errors).toEqual([]);
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    const url = new URL(request.url);
    const path = url.pathname.slice(new URL(base).pathname.length);
    expect(
      path === "" ||
        /^(?:assets\/[^/]+\.(?:js|css)|index\.html|manifest\.webmanifest|sw\.js|workbox-[\w-]+\.js|(?:apple-touch-icon|icon-192|icon-512)\.png|icon\.svg)$/.test(
          path,
        ),
    ).toBe(true);
    expect(
      [...url.searchParams.keys()].filter((key) => key !== "__WB_REVISION__"),
    ).toEqual([]);
  }
  expect(
    requests.filter(
      ({ url, method }) => !url.startsWith(base) || method !== "GET",
    ),
  ).toEqual([]);
  expect(
    requests.filter(
      ({ url, type }) =>
        /\/api(?:\/|\?|$)/.test(url) ||
        (["xhr", "fetch", "websocket", "eventsource"].includes(type) &&
          !/\.(?:js|css|html|png|svg|webmanifest)(?:\?|$)/.test(url)),
    ),
  ).toEqual([]);
  await test.info().attach("static-network-audit", {
    body: JSON.stringify(requests, null, 2),
    contentType: "application/json",
  });
});
