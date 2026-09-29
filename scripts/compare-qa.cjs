const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const output = process.env.QA_OUTPUT || "/tmp/turf-taste-comparison-qa";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const results = [];
  const check = (name, condition) => {
    assert.ok(condition, name);
    results.push(name);
  };
  await page.goto("http://127.0.0.1:3001");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("link", { name: "Book Now", exact: true }).click();
  await page.waitForURL("**/facilities");
  check(
    "Home → Facilities via Book Now",
    (await page
      .getByRole("heading", { name: "Venues", exact: true })
      .count()) === 1,
  );
  await page
    .getByRole("link", { name: "View Arena & Slots", exact: true })
    .first()
    .click();
  await page.waitForURL("**/facilities/detail");
  check(
    "Facilities → curated Facility Detail",
    (await page
      .getByRole("heading", { name: "[Facility Name]", exact: true })
      .count()) === 1,
  );
  await page.getByRole("button", { name: "Select Date & Time" }).click();
  check(
    "Booking CTA reports explicit out-of-scope status",
    await page.getByRole("status").isVisible(),
  );
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await page.getByRole("link", { name: "Back to Facilities" }).click();
  await page.waitForURL("**/facilities");
  await page.getByRole("link", { name: "Back to Home" }).click();
  await page.waitForURL("http://127.0.0.1:3001/");
  check(
    "Both explicit back paths work",
    await page
      .getByRole("heading", { name: "Good afternoon, Devansh" })
      .isVisible(),
  );
  await page.getByRole("link", { name: "Venues", exact: true }).click();
  await page.waitForURL("**/facilities");
  await page.getByRole("button", { name: "Skating Rink", exact: true }).click();
  check(
    "Activity selection filters fixtures",
    (await page.locator(".venue-card").count()) === 1,
  );
  check(
    "Selected activity is exposed to assistive technology",
    (await page
      .getByRole("button", { name: "Skating Rink", exact: true })
      .getAttribute("aria-pressed")) === "true",
  );
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search arenas, turfs, sports" })
    .fill("Masterstroke");
  check(
    "Search filters venues",
    (await page.locator(".venue-card").count()) === 1,
  );
  await page
    .getByRole("textbox", { name: "Search arenas, turfs, sports" })
    .fill("no-matching-venue");
  check(
    "Search empty state is recoverable",
    await page.getByText("No matching arenas.", { exact: true }).isVisible(),
  );
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  check(
    "Clear filters restores all three venues",
    (await page.locator(".venue-card").count()) === 3,
  );
  await page
    .getByRole("button", { name: "Activity filters", exact: true })
    .click();
  check(
    "Filter control opens",
    (await page
      .getByRole("button", { name: "Activity filters", exact: true })
      .getAttribute("aria-expanded")) === "true",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page
    .getByRole("link", { name: "View Arena & Slots", exact: true })
    .last()
    .click();
  await page.waitForURL("**/facilities/detail");
  await page.goBack();
  await page.waitForURL("**/facilities");
  check(
    "Browser history back works",
    await page
      .getByRole("heading", { name: "Venues", exact: true })
      .isVisible(),
  );
  for (const width of [390, 320, 360, 480]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [name, path] of [
      ["home", "/"],
      ["facilities", "/facilities"],
      ["detail", "/facilities/detail"],
    ]) {
      await page.goto("http://127.0.0.1:3001" + path);
      await page.evaluate(() => document.fonts.ready);
      const info = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        height: document.documentElement.scrollHeight,
        images: [...document.images].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
        text: document.querySelector("main").innerText,
      }));
      check(`${name} ${width}px: no horizontal overflow`, !info.overflow);
      check(`${name} ${width}px: long-page scrolling`, info.height > 844);
      check(`${name} ${width}px: all assets load`, info.images);
      check(
        `${name} ${width}px: no unauthorized sports or Admin`,
        !/\b(Football|Tennis|Padel|Badminton|Basketball|Squash|Golf|Admin)\b/i.test(
          info.text,
        ),
      );
      await page.evaluate(() =>
        scrollTo(0, document.documentElement.scrollHeight),
      );
      check(
        `${name} ${width}px: scrolling reaches bottom`,
        await page.evaluate(
          () =>
            scrollY > 0 &&
            Math.abs(
              document.documentElement.scrollHeight - innerHeight - scrollY,
            ) < 2,
        ),
      );
      const control = page.locator(
        name === "detail" ? ".detail-action" : ".bottom-nav",
      );
      const box = await control.boundingBox();
      check(
        `${name} ${width}px: fixed controls stay visible`,
        box.y >= 0 && box.y + box.height <= 845,
      );
      if (width === 390) {
        await page.screenshot({ path: `${output}/${name}-bottom.png` });
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `${output}/${name}-viewport.png` });
      }
    }
  }
  check("No runtime or console errors", errors.length === 0);
  fs.writeFileSync(
    `${output}/qa-results.json`,
    JSON.stringify({ checks: results.length, results, errors }, null, 2),
  );
  console.log(
    `PASS: ${results.length} checks; ${errors.length} console/runtime errors.`,
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
