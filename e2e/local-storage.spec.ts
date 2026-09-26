import { test, expect } from "@playwright/test";
import { setup, createUI, inject, offline } from "./local-fixture";
import { png } from "./fixture";
test("10k gallery metadata, bounded DOM, filters, viewer and detail scroll return", async ({
  page,
}) => {
  test.setTimeout(180000);
  await setup(page);
  await createUI(page);
  await inject(page);
  await page.evaluate(async () => {
    const h = window.localTest,
      s = (await h.seriesRepository.list())[0],
      c = await h.cardRepository.get(s.root_card_id),
      image = await h.imageRepository.get(c.images[0].id),
      db = await h.database();
    for (let start = 0; start < 10000; start += 250) {
      const tx = db.transaction(["images", "cards"], "readwrite"),
        writes: Promise<unknown>[] = [];
      for (let n = start; n < start + 250; n++) {
        const cardId = "gallery-card-" + Math.floor(n / 20);
        if (n % 20 === 0)
          writes.push(
            tx.objectStore("cards").put({
              ...c,
              id: cardId,
              is_root: false,
              display_id: "PHOTO-" + Math.floor(n / 20),
              images: [],
              cover_image_id: "synthetic-" + String(n).padStart(5, "0"),
            }),
          );
        writes.push(
          tx.objectStore("images").put({
            ...image,
            id: "synthetic-" + String(n).padStart(5, "0"),
            card_id: cardId,
            is_root: false,
            created_at: n,
            is_favorite: n % 5 === 0 ? 1 : 0,
          }),
        );
      }
      await Promise.all(writes);
      await tx.done;
    }
  });
  await page.getByRole("link", { name: "画像", exact: true }).click();
  await expect
    .poll(() => page.getByTestId("image-cell").count())
    .toBeGreaterThan(0);
  expect(await page.getByTestId("image-cell").count()).toBeLessThan(150);
  const scroll = page.getByTestId("gallery-scroll");
  await scroll.evaluate((el) => (el.scrollTop = 1500));
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(1000);
  const top = await scroll.evaluate((el) => el.scrollTop);
  // Scrolling updates virtual rows asynchronously. A DOM index captured before
  // that render can become -1 or refer to another cell, causing click() to scroll.
  // Wait for an on-screen image and keep its stable label across row recycling.
  let visibleImageLabel: string | null = null;
  await expect
    .poll(async () => {
      visibleImageLabel = await page
        .getByTestId("image-cell")
        .evaluateAll((nodes) => {
          const parent = document
            .querySelector("[data-testid=gallery-scroll]")!
            .getBoundingClientRect();
          return (
            nodes
              .find((el) => {
                const rect = el.getBoundingClientRect();
                return rect.top >= parent.top && rect.bottom <= parent.bottom;
              })
              ?.getAttribute("aria-label") ?? null
          );
        });
      return visibleImageLabel;
    })
    .not.toBeNull();
  await page
    .getByRole("button", { name: visibleImageLabel!, exact: true })
    .click();
  expect(await scroll.evaluate((el) => el.scrollTop)).toBe(top);
  await expect(page.locator(".pswp__img").first()).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page
    .locator(".viewer-actions")
    .getByRole("button", { name: "詳細", exact: true })
    .click();
  await page.getByRole("button", { name: "← 戻る" }).click();
  expect(await scroll.evaluate((el) => el.scrollTop)).toBe(top);
  await page.getByLabel("画像の種類").selectOption("favorite");
  await expect
    .poll(() => page.getByTestId("image-cell").count())
    .toBeGreaterThan(0);
  expect(await page.getByTestId("image-cell").count()).toBeLessThan(150);
  await page.screenshot({
    path: "work/local-gallery-" + test.info().project.name + ".png",
  });
});
test("OPFS unavailable uses local Blob fallback and quota failure never creates a ready Card", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(
      Object.getPrototypeOf(navigator.storage),
      "getDirectory",
      { configurable: true, value: undefined },
    );
    Object.defineProperty(
      Object.getPrototypeOf(navigator.storage),
      "persisted",
      { configurable: true, value: async () => false },
    );
  });
  await setup(page);
  await createUI(page);
  await inject(page);
  expect(
    await page.evaluate(async () => {
      const h = window.localTest,
        s = (await h.seriesRepository.list())[0],
        c = await h.cardRepository.get(s.root_card_id);
      return (await h.imageRepository.get(c.images[0].id)).backend;
    }),
  ).toBe("idb");
  await page.evaluate(() => {
    Object.defineProperty(
      Object.getPrototypeOf(navigator.storage),
      "estimate",
      { configurable: true, value: async () => ({ usage: 980, quota: 1000 }) },
    );
  });
  await page
    .getByRole("button", { name: "シリーズを作成", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "quota.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("保存容量が不足");
  expect(
    await page.evaluate(async () => {
      const h = window.localTest;
      return (await h.seriesRepository.list()).length;
    }),
  ).toBe(1);
});
for (const status of ["granted", "denied", "unsupported"] as const)
  test("persistent storage UI: " + status, async ({ page }) => {
    await page.addInitScript((status) => {
      Object.defineProperty(
        Object.getPrototypeOf(navigator.storage),
        "persisted",
        {
          configurable: true,
          value:
            status === "unsupported"
              ? undefined
              : async () => status === "granted",
        },
      );
      Object.defineProperty(
        Object.getPrototypeOf(navigator.storage),
        "persist",
        {
          configurable: true,
          value:
            status === "unsupported"
              ? undefined
              : async () => status === "granted",
        },
      );
    }, status);
    await setup(page);
    await page.getByRole("link", { name: "設定", exact: true }).click();
    await expect(page.getByTestId("persistence-status")).toContainText(
      status === "granted" ? "有効" : status === "denied" ? "未承認" : "非対応",
    );
  });
test("offline edit, child, search and data reset", async ({
  page,
  context,
  browserName,
}) => {
  await setup(page, browserName === "webkit");
  await createUI(page);
  await inject(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await offline(page, context, browserName);
  await page.getByRole("button", { name: "A-000", exact: true }).click();
  await page
    .getByRole("button", { name: "編集・画像追加", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Full Prompt", exact: true })
    .fill("オフラインで変更した研究");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "カード詳細", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("オフラインで変更した研究", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "この画像から派生", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "新しい実験", exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "child.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("1枚を選択中", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await page.getByRole("button", { name: "← 戻る", exact: true }).click();
  await page.getByRole("link", { name: "検索", exact: true }).click();
  await page.getByRole("searchbox").fill("オフライン");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.getByRole("link", { name: "設定", exact: true }).click();
  await page
    .getByRole("button", { name: "この端末のデータをリセット", exact: true })
    .click();
  await page.getByLabel("リセット確認", { exact: true }).fill("DELETE");
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "完全に削除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "PINを設定して始める", exact: true }),
  ).toBeVisible();
});
