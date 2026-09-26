import { test, expect } from "@playwright/test";
import { setup, unlock, createUI, inject, offline } from "./local-fixture";
import { png } from "./fixture";
test("offline multi-image CRUD, exact originals, reload lock, search and network audit", async ({
  page,
  context,
  browserName,
}) => {
  await setup(page, browserName === "webkit");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http")) return;
    if (
      ![
        "document",
        "script",
        "stylesheet",
        "image",
        "manifest",
        "other",
      ].includes(r.resourceType()) ||
      r.url().includes("/api")
    )
      requests.push(r.url());
  });
  await offline(page, context, browserName);
  await createUI(page, 5);
  await inject(page);
  const snapshot = await page.evaluate(async () => {
    const h = window.localTest,
      s = (await h.seriesRepository.list())[0],
      c = await h.cardRepository.get(s.root_card_id);
    return {
      c,
      bytes: [
        ...new Uint8Array(
          await (
            await h.imageRepository.original(c.images[0].id)
          ).arrayBuffer(),
        ),
      ],
    };
  });
  expect(snapshot.c.images).toHaveLength(5);
  expect(Buffer.from(snapshot.bytes)).toEqual(png);
  expect(snapshot.c.images[0].thumbnail_key).toBeTruthy();
  await page.getByRole("button", { name: "A-000", exact: true }).click();
  await page
    .getByRole("button", { name: "画像 1 を表示", exact: true })
    .click();
  await expect(page.locator(".pswp__img").first()).toBeVisible();
  await expect(page.locator(".pswp__img").first()).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page.locator(".pswp__button--close").click();
  await page.getByRole("button", { name: "← 戻る" }).click();
  await page.getByRole("link", { name: "検索", exact: true }).click();
  await page.getByRole("searchbox").fill("街角");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await unlock(page);
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "A-000", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});
test("tree retains viewport for 20 detail returns, long press move, undo, orientation and zero document scroll", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90000);
  await setup(page, browserName === "webkit");
  await createUI(page, 2);
  await inject(page);
  const s = await page.evaluate(async () => {
    const h = window.localTest,
      s = (await h.seriesRepository.list())[0],
      root = await h.cardRepository.get(s.root_card_id),
      child = await h.cardRepository.create(s.id, { parent_id: root.id });
    await h.imageRepository.import(
      child.id,
      new File(
        [await h.imageRepository.original(root.images[0].id)],
        "child.png",
        { type: "image/png" },
      ),
    );
    return s;
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await offline(page, context, browserName);
  await page.getByRole("link", { name: "ツリー", exact: true }).click();
  await page.getByRole("button", { name: "A-000", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByRole("button", { name: "全体表示", exact: true }).click();
  const pane = page.locator(".react-flow__pane"),
    box = await pane.boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + 200);
  await page.mouse.down();
  await page.mouse.move(box!.x + 70, box!.y + 220, { steps: 5 });
  await page.mouse.up();
  const viewport = page.locator(".react-flow__viewport"),
    before = await viewport.getAttribute("style");
  for (let n = 0; n < 20; n++) {
    await page.locator(".react-flow__node").first().click();
    await expect(
      page.getByRole("dialog", { name: "カード詳細" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "← 戻る" }).click();
    expect(await viewport.getAttribute("style")).toBe(before);
  }
  const pinch = async () => {
    const beforePinch = await viewport.getAttribute("style");
    await pane.evaluate(async (element) => {
      const rect = element.getBoundingClientRect(),
        x = rect.left + rect.width / 2,
        y = rect.top + rect.height / 2;
      const touches = (distance: number) => [
        {
          identifier: 1,
          target: element,
          clientX: x - distance,
          clientY: y,
          pageX: x - distance,
          pageY: y,
        },
        {
          identifier: 2,
          target: element,
          clientX: x + distance,
          clientY: y,
          pageX: x + distance,
          pageY: y,
        },
      ];
      const first = touches(40),
        last = touches(75);
      const dispatch = (
        name: string,
        touches: typeof first,
        changedTouches: typeof first,
      ) =>
        element.dispatchEvent(
          Object.assign(new Event(name, { bubbles: true, cancelable: true }), {
            touches,
            targetTouches: touches,
            changedTouches,
          }),
        );
      dispatch("touchstart", first, first);
      dispatch("touchmove", last, last);
      dispatch("touchend", [], last);
    });
    await expect(viewport).not.toHaveAttribute("style", beforePinch!);
  };
  await page.getByRole("button", { name: "全体表示", exact: true }).click();
  const node = page.locator(".react-flow__node").first(),
    id = (await node.getAttribute("data-id"))!,
    original = await page.evaluate(
      async (id) => (await window.localTest.cardRepository.get(id)).canvas_x,
      id,
    ),
    rect = await node.boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.mouse.down();
  await expect(node.locator(".armed")).toBeVisible();
  await page.mouse.move(
    rect!.x + rect!.width / 2 + 35,
    rect!.y + rect!.height / 2 + 30,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        async (id) => (await window.localTest.cardRepository.get(id)).canvas_x,
        id,
      ),
    )
    .not.toBe(original);
  await page.getByRole("button", { name: "↶", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async (id) => (await window.localTest.cardRepository.get(id)).canvas_x,
        id,
      ),
    )
    .toBe(original);
  const positions = await page.evaluate(
    async (id) =>
      (await window.localTest.treeRepository.get(id)).nodes.map((n) => [
        n.id,
        n.canvas_x,
        n.canvas_y,
      ]),
    s.id,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      async (id) =>
        (await window.localTest.treeRepository.get(id)).nodes.map((n) => [
          n.id,
          n.canvas_x,
          n.canvas_y,
        ]),
      s.id,
    ),
  ).toEqual(positions);
  await page.evaluate(() => window.scrollTo(0, 1000));
  expect(
    await page.evaluate(() => [
      document.body.scrollTop,
      document.documentElement.scrollTop,
    ]),
  ).toEqual([0, 0]);
  await pinch();
});
test("local PIN auto lock and private background", async ({ page }) => {
  await setup(page);
  await page.clock.install();
  await page.clock.fastForward(300001);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByLabel("4桁のPIN", { exact: true }).fill("0000");
  await page.getByRole("button", { name: "ロック解除", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("違います");
  await unlock(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByLabel("プライバシー保護")).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("full backup download and restore UI", async ({ page }) => {
  test.setTimeout(60000);
  await setup(page);
  await createUI(page, 2);
  await page.getByRole("link", { name: "設定", exact: true }).click();
  await expect(page.getByText(/1 Cards · 2 Originals/)).toBeVisible();
  await page
    .getByRole("button", { name: "完全バックアップを作成", exact: true })
    .click();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    }),
  );
  await expect(
    page.getByRole("button", { name: "このPartを保存", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "このPartを保存", exact: true })
    .click();
  const file = await download;
  await page
    .getByRole("button", { name: "全Partの保存を確認・完了", exact: true })
    .click();
  page.on("dialog", (d) => void d.accept());
  await page
    .getByLabel("バックアップから復元")
    .setInputFiles((await file.path())!);
  await expect(page.getByText("復元しました", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "A-000", exact: true }),
  ).toBeVisible();
});
