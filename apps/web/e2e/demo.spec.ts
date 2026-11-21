import { expect, test } from "@playwright/test";

const naira = (s: string | null) => Number((s ?? "").replace(/[^\d]/g, ""));

test("demo path: sample sketch → plan, 3D and a Naira total that moves with the walls", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("cta-sample").click();
  await expect(page).toHaveURL(/\/build/);

  const total = page.getByTestId("boq-total");
  await expect(total).toContainText("₦");
  await expect(page.getByTestId("scene-3d").locator("canvas")).toBeVisible();
  // Let the count-up animation settle.
  await page.waitForTimeout(1200);
  const before = naira(await total.textContent());
  expect(before).toBeGreaterThan(1_000_000);

  // Drag the right-hand external wall outwards by ~1 m: the building grows, so the total must rise.
  const wall = await page.evaluate(() => {
    const polys = [...document.querySelectorAll<SVGPolygonElement>("[data-wall]")];
    const rects = polys.map((p) => ({ id: p.dataset.wall!, r: p.getBoundingClientRect() }));
    const rightmost = rects.filter((x) => x.r.height > x.r.width).sort((a, b) => b.r.right - a.r.right)[0]!;
    return { id: rightmost.id, x: rightmost.r.left + rightmost.r.width / 2, y: rightmost.r.top + rightmost.r.height * 0.2 };
  });
  await page.mouse.move(wall.x, wall.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(wall.x + i * 4, wall.y);
  await page.mouse.up();

  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.waitForTimeout(1200);
  const after = naira(await total.textContent());
  expect(after).toBeGreaterThan(before);

  // Undo restores the original estimate.
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(1200);
  expect(naira(await total.textContent())).toBe(before);
});

test("rates are editable and change the total", async ({ page }) => {
  await page.goto("/build?sample=1");
  const total = page.getByTestId("boq-total");
  await page.waitForTimeout(1200);
  const before = naira(await total.textContent());
  await page.getByRole("tab", { name: "Materials & rates" }).click();
  const cement = page.getByLabel(/Rate for Cement/);
  await cement.fill("20000");
  await cement.press("Enter");
  await page.waitForTimeout(1200);
  expect(naira(await total.textContent())).toBeGreaterThan(before);
});
