import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, zipSync } from "fflate";
import { setup, createUI, inject, unlock } from "./local-fixture";

test("full research backup, corrupt restore isolation, original bytes and reference integrity", async ({
  page,
}) => {
  test.setTimeout(90000);
  await setup(page);
  await createUI(page, 5);
  await inject(page);
  const before = await page.evaluate(async () => {
    const h = window.localTest,
      s = (await h.seriesRepository.list())[0],
      root = await h.cardRepository.get(s.root_card_id);
    const a = await h.cardRepository.create(s.id, {
      parent_id: root.id,
      tags: ["研究", "child"],
      rating: 4,
      prompt_full: "full research",
    });
    const b = await h.cardRepository.create(s.id, {
      parent_id: root.id,
      additional_parent_ids: [a.id],
      prompt_delta: "variation",
      memo: "memo",
    });
    for (const c of [a, b])
      await h.imageRepository.import(
        c.id,
        new File(
          [await h.imageRepository.original(root.images[0].id)],
          "child.png",
          { type: "image/png" },
        ),
      );
    await h.treeRepository.createEdge({
      source_card_id: b.id,
      target_card_id: a.id,
      kind: "reference",
      color: "#123456",
    });
    await h.treeRepository.saveViewport(s.id, {
      x: 120.25,
      y: -250.5,
      zoom: 0.75,
    });
    await h.treeRepository.positions(s.id, {
      positions: [{ id: b.id, x: 830.5, y: 516.25 }],
    });
    return h.snapshot();
  });
  await page.getByRole("link", { name: "設定", exact: true }).click();
  await expect(page.getByText(/3 Cards · 7 Originals/)).toBeVisible();
  await page
    .getByRole("button", { name: "完全バックアップを作成", exact: true })
    .click();
  const save = page.getByRole("button", {
    name: "このPartを保存",
    exact: true,
  });
  await expect(save).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(Navigator.prototype, "canShare", {
      configurable: true,
      value: () => false,
    }),
  );
  const download = page.waitForEvent("download");
  await save.click();
  const path = (await (await download).path())!;
  await page
    .getByRole("button", { name: "全Partの保存を確認・完了", exact: true })
    .click();
  const archive = unzipSync(new Uint8Array(await readFile(path)));
  const image = Object.keys(archive).find((key) => key.startsWith("images/"))!;
  archive[image][0] ^= 255;
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByLabel("バックアップから復元").setInputFiles({
    name: "corrupt.ptbackup",
    mimeType: "application/zip",
    buffer: Buffer.from(zipSync(archive, { level: 0 })),
  });
  await expect(page.getByRole("alert")).toContainText("Originalの検証に失敗");
  expect(await page.evaluate(() => window.localTest.activeWorkspace())).toBe(
    before.w,
  );
  expect(
    await page.evaluate(async () => {
      const h = window.localTest,
        s = (await h.seriesRepository.list())[0];
      return (await h.cardRepository.get(s.root_card_id)).images.length;
    }),
  ).toBe(5);
  await page.getByLabel("バックアップから復元").setInputFiles(path);
  await expect(page.getByText("復元しました", { exact: true })).toBeVisible();
  const after = await page.evaluate(() => window.localTest.snapshot());
  expect(after.w).not.toBe(before.w);
  const research = (data: typeof before.data) => ({
    cards: data.cards
      .map((c) => ({
        label: c.display_id,
        prompt: c.prompt_full,
        delta: c.prompt_delta,
        memo: c.memo,
        tags: c.tags,
        rating: c.rating,
        x: c.canvas_x,
        y: c.canvas_y,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    edges: data.edges
      .map((e) => ({
        from: data.cards.find((c) => c.id === e.source_card_id)!.display_id,
        to: data.cards.find((c) => c.id === e.target_card_id)!.display_id,
        kind: e.kind,
        primary: e.is_primary,
        color: e.color,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    viewport: data.series.map((s) => [
      s.viewport_x,
      s.viewport_y,
      s.viewport_zoom,
    ]),
    images: data.images.length,
  });
  expect(research(after.data)).toEqual(research(before.data));
  await page.reload();
  await unlock(page);
  await inject(page);
  expect((await page.evaluate(() => window.localTest.snapshot())).w).toBe(
    after.w,
  );
});

test("home long press reorder, IndexedDB draft reload and brief privacy state retention", async ({
  page,
}) => {
  await setup(page);
  await createUI(page);
  await inject(page);
  await page.evaluate(async () => {
    const h = window.localTest,
      s = (await h.seriesRepository.list())[0];
    await h.cardRepository.duplicate(s.root_card_id);
    window.dispatchEvent(new Event("data-changed"));
  });
  const tiles = page.locator(".series-tile");
  await expect(tiles).toHaveCount(2);
  const first = (await tiles.first().boundingBox())!,
    second = (await tiles.nth(1).boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await expect(tiles.first()).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(
    second.x + second.width / 2,
    second.y + second.height / 2,
    { steps: 12 },
  );
  await expect
    .poll(async () => (await tiles.first().boundingBox())!.x)
    .toBeGreaterThan(first.x + 50);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.mouse.up();
  await expect(tiles.first()).toHaveAttribute("aria-label", "B-000");
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await window.localTest.seriesRepository.list())[0].display_id,
      ),
    )
    .toBe("B-000");
  await page.reload();
  await unlock(page);
  await expect(tiles.first()).toHaveAttribute("aria-label", "B-000");
  await page
    .getByRole("button", { name: "シリーズを作成", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Full Prompt", exact: true })
    .fill("永続的な下書き");
  await inject(page);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const h = window.localTest;
        return (await (await h.database()).getAll("drafts")).length;
      }),
    )
    .toBe(1);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await unlock(page);
  await expect(
    page.getByRole("textbox", { name: "Full Prompt", exact: true }),
  ).toHaveValue("永続的な下書き");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByLabel("プライバシー保護")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("textbox", { name: "Full Prompt", exact: true }),
  ).toHaveValue("永続的な下書き");
});
