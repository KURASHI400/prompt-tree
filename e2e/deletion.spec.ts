import { test, expect, type Page } from "@playwright/test";
import { setup, createUI, inject, offline, unlock } from "./local-fixture";

async function seed(page: Page) {
  await createUI(page, 2);
  await inject(page);
  return page.evaluate(async () => {
    const h = window.localTest,
      s = (await h.seriesRepository.list())[0];
    const root = await h.cardRepository.get(s.root_card_id);
    const original = await h.imageRepository.original(root.images[0].id);
    const file = new File([original], "child.png", { type: "image/png" });
    const parent = await h.cardRepository.create(s.id, {
      parent_id: root.id,
      prompt_full: "削除対象の研究",
      tags: ["削除テスト"],
    });
    await h.imageRepository.import(parent.id, file);
    await h.imageRepository.import(parent.id, file);
    const child = await h.cardRepository.create(s.id, { parent_id: parent.id });
    await h.imageRepository.import(child.id, file);
    await h.treeRepository.createEdge({
      source_card_id: child.id,
      target_card_id: parent.id,
      kind: "reference",
      color: "#668bd5",
    });
    await h.treeRepository.positions(s.id, {
      positions: [
        { id: root.id, x: 0, y: 0 },
        { id: parent.id, x: 0, y: 300 },
        { id: child.id, x: 0, y: 600 },
      ],
    });
    await h.treeRepository.saveViewport(s.id, { x: 40, y: 20, zoom: 0.6 });
    window.dispatchEvent(new Event("data-changed"));
    return { series: s.id, root: root.id, parent: parent.id, child: child.id };
  });
}
async function deleteMenu(page: Page, series: boolean) {
  await page.getByRole("button", { name: "操作メニュー", exact: true }).click();
  await page
    .getByRole("dialog", { name: "操作メニュー", exact: true })
    .getByRole("button", {
      name: series ? "シリーズを削除" : "カードを削除",
      exact: true,
    })
    .click();
}
test("iPhone child deletion and Undo preserve descendants and TREE viewport; Gallery/Search remove deleted data", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  const ids = await seed(page);
  await page.evaluate((id) => {
    location.hash = `/series/${id}/tree`;
  }, ids.series);
  await expect(
    page.getByRole("button", { name: "A-001", exact: true }),
  ).toBeVisible();
  const viewport = page.locator(".react-flow__viewport"),
    before = await viewport.getAttribute("style");
  await page.getByRole("button", { name: "A-001", exact: true }).click();
  const menu = page.getByRole("button", { name: "操作メニュー", exact: true });
  const box = await menu.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await deleteMenu(page, false);
  await expect(page.getByRole("alertdialog")).toContainText(
    "派生した子カードは残ります",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "キャンセル", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "カード詳細" })).toBeVisible();
  await deleteMenu(page, false);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "カードを削除", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "A-001", exact: true }),
  ).toHaveCount(0);
  expect(await viewport.getAttribute("style")).toBe(before);
  await expect(page.getByRole("status")).toContainText("削除しました");
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "A-001", exact: true }),
  ).toBeVisible();
  expect(await viewport.getAttribute("style")).toBe(before);
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollTop,
      document.body.scrollTop,
    ]),
  ).toEqual([0, 0]);
  await page.getByRole("link", { name: "検索", exact: true }).click();
  await page.getByRole("searchbox").fill("削除対象");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.locator(".search-result").click();
  await page.getByRole("button", { name: "操作メニュー", exact: true }).click();
  await page
    .getByRole("dialog", { name: "操作メニュー", exact: true })
    .getByRole("button", { name: "編集", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Danger Zone" })
    .getByRole("button", { name: "カードを削除", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "カードを削除", exact: true })
    .click();
  await expect(page.locator(".search-result")).toHaveCount(0);
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.locator(".search-result").click();
  await deleteMenu(page, false);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "カードを削除", exact: true })
    .click();
  await expect(page.locator(".search-result")).toHaveCount(0);
  await page.getByRole("link", { name: "画像", exact: true }).click();
  await expect(page.getByTestId("image-cell")).toHaveCount(3);
  await page.reload();
  await unlock(page);
  await inject(page);
  await expect(page.getByTestId("image-cell")).toHaveCount(3);
  expect(
    await page.evaluate(
      async (id) => !!(await window.localTest.cardRepository.get(id)),
      ids.child,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("HOME and editor expose series deletion, bounded iPhone dialogs and complete Undo", async ({
  page,
}) => {
  await setup(page);
  await seed(page);
  await page
    .getByRole("button", { name: "A-000の操作メニュー", exact: true })
    .click();
  await page
    .getByRole("button", { name: "シリーズを削除", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("カード 3件");
  await expect(dialog).toContainText("画像 5枚");
  await page.screenshot({
    path: "work/delete-dialog-" + test.info().project.name + ".png",
  });
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await dialog
      .getByRole("button", { name: "シリーズを削除", exact: true })
      .scrollIntoViewIfNeeded();
  }
  await dialog
    .getByRole("button", { name: "シリーズを削除", exact: true })
    .click();
  await expect(page.locator(".series-tile")).toHaveCount(0);
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(page.locator(".series-tile")).toHaveCount(1);
  await page
    .getByRole("button", { name: "A-000の操作メニュー", exact: true })
    .click();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page
    .getByRole("region", { name: "Danger Zone" })
    .getByRole("button", { name: "シリーズを削除", exact: true })
    .click();
  await expect(dialog).toContainText("カード 3件");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "キャンセル", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Danger Zone" })).toBeVisible();
});

test("offline root deletion cleans actual Original/Thumbnail files after ten seconds and survives reload", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(60000);
  await setup(page, true);
  const ids = await seed(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const originals = await page.evaluate(async () => {
    const db = await window.localTest.database();
    return db.getAll("images");
  });
  if (browserName === "chromium")
    expect(originals.every((i) => i.backend === "opfs")).toBe(true);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (
      ["fetch", "xhr"].includes(r.resourceType()) ||
      (r.url().startsWith("http") &&
        new URL(r.url()).origin !== new URL(page.url()).origin)
    )
      requests.push(r.url());
  });
  await offline(page, context, browserName);
  await page.locator(".series-tile").click();
  await deleteMenu(page, true);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "シリーズを削除", exact: true })
    .click();
  await expect(page.locator(".series-tile")).toHaveCount(0);
  expect(
    await page.evaluate(
      async (i) =>
        (
          await (
            await window.localTest.fileStore(i.backend)
          ).read(i.original_key)
        ).size,
      originals[0],
    ),
  ).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "元に戻す", exact: true }),
  ).toHaveCount(0, { timeout: 15000 });
  await expect
    .poll(() =>
      page.evaluate(
        async (id) =>
          !(await (await window.localTest.database()).get("series", id)),
        ids.series,
      ),
    )
    .toBe(true);
  const result = await page.evaluate(async (originals) => {
    const h = window.localTest,
      db = await h.database();
    let present = 0;
    for (const i of originals)
      for (const key of [i.original_key, i.thumbnail_key])
        if (key) {
          try {
            await (await h.fileStore(i.backend)).read(key);
            present++;
          } catch {
            /* Expected missing file. */
          }
        }
    return {
      present,
      cards: await db.count("cards"),
      images: await db.count("images"),
      edges: await db.count("edges"),
      relations: await db.count("cardTags"),
      queue: await db.count("cleanupQueue"),
    };
  }, originals);
  expect(result).toEqual({
    present: 0,
    cards: 0,
    images: 0,
    edges: 0,
    relations: 0,
    queue: 0,
  });
  await page.reload();
  await unlock(page);
  await expect(page.locator(".series-tile")).toHaveCount(0);
  expect(requests).toEqual([]);
});
