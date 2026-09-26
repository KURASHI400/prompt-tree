import { test, expect, chromium, webkit } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { setup, createUI, inject, unlock } from "./local-fixture";
import { png } from "./fixture";

test("closing and reopening a browser preserves local metadata, original bytes and PIN", async ({
  browserName,
}) => {
  test.setTimeout(120000);
  const directory = await mkdtemp(resolve(tmpdir(), "prompt-tree-e2e-"));
  const browserType = browserName === "webkit" ? webkit : chromium;
  const options = {
    headless: true,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    baseURL: "http://127.0.0.1:4173",
  };
  let context = await test.step("open persistent profile", () =>
    browserType.launchPersistentContext(directory, options));
  try {
    const page = await context.newPage();
    await setup(page);
    await createUI(page);
    await inject(page);
    const before = await page.evaluate(async () => {
      const h = window.localTest,
        s = (await h.seriesRepository.list())[0],
        c = await h.cardRepository.get(s.root_card_id);
      return { workspace: await h.activeWorkspace(), image: c.images[0].id };
    });
    await test.step("close persistent profile", () => context.close());
    context = await test.step("reopen persistent profile", () =>
      browserType.launchPersistentContext(directory, options));
    const reopened = await context.newPage();
    await reopened.goto("/#/home");
    await expect(reopened.getByRole("navigation")).toHaveCount(0);
    await unlock(reopened);
    await inject(reopened);
    const restored = await reopened.evaluate(async ({ image }) => {
      const h = window.localTest;
      return {
        workspace: await h.activeWorkspace(),
        bytes: [
          ...new Uint8Array(
            await (await h.imageRepository.original(image)).arrayBuffer(),
          ),
        ],
      };
    }, before);
    expect(restored.workspace).toBe(before.workspace);
    expect(Buffer.from(restored.bytes)).toEqual(png);
  } finally {
    await context.close();
  }
});
