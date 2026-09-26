import { test, expect } from "@playwright/test";
import { setup, offline, unlock, createUI } from "./local-fixture";
test("static app shell loads without a backend", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("#root")).toBeAttached();
});
test("subdirectory static hosting retains an offline app shell", async ({
  page,
  context,
  browserName,
}) => {
  await setup(page, true, "/research/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    )
    .toContain("/research/sw.js");
  await offline(page, context, browserName);
  await page.reload();
  await unlock(page);
  await createUI(page);
});
