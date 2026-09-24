/**
 * End-to-end smoke check for the Emberforge preview.
 *
 *   1. page loads, boot screen clears, title screen renders over a live 3D canvas
 *   2. WebGL context is alive and the render loop is producing frames
 *   3. a new game can be started (HUD appears)
 *   4. panels open/close via B / I / M / H / Esc
 *   5. the player actually moves when W is held (position read via the map dot)
 *   6. no page errors or console errors along the way
 *
 * Run against a running dev server:
 *   node scripts/verify-preview.mjs [url]
 *
 * Requires playwright, which is intentionally not a saved dependency:
 *   npm i --no-save --no-package-lock playwright && npx playwright install --with-deps chromium
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const URL = process.argv[2] || "http://127.0.0.1:5173/";
const SHOTS = "screenshots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1152, height: 720 } });
// SwiftShader software rendering is slow — give compositing generous slack.
page.setDefaultTimeout(60000);
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}`, timeout: 60000 });

const benign = /favicon|websocket|HMR|\[vite\]|connect/i;
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error" && !benign.test(msg.text())) {
    errors.push(`console.error: ${msg.text()}`);
  }
});

try {
  /* ---------------------------------------------------------- load + title */
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForSelector(".title-screen", { timeout: 60000 });
  check("title screen appears after boot", true);

  const logo = await page.textContent(".title-logo");
  check("title logo renders", /EMBER/.test(logo || ""), (logo || "").trim());

  const gl = await page.evaluate(() => {
    const c = document.querySelector("#game-root canvas");
    if (!c) return { canvas: false };
    const ctx = c.getContext("webgl2") || c.getContext("webgl");
    return {
      canvas: true,
      w: c.width,
      h: c.height,
      webgl: !!ctx,
      lost: ctx ? ctx.isContextLost() : null,
    };
  });
  check("3D canvas mounted", gl.canvas && gl.w > 0, `${gl.w}x${gl.h}`);
  check("WebGL context alive", !!gl.webgl && gl.lost === false);

  const frames = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n += 1;
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
          else res(n);
        };
        requestAnimationFrame(tick);
      })
  );
  check("render loop producing frames", frames >= 4, `${frames} frames in 2000ms`);
  await shot("1-title.png");

  /* ------------------------------------------------------------- new game */
  await page.waitForSelector(".title-screen .btn-primary", { timeout: 10000 });
  await page.click(".title-screen .btn-primary");
  await page.waitForSelector(".hud", { timeout: 10000 });
  check("new game starts (HUD visible)", true);
  check("title screen dismissed", !(await page.$(".title-screen")));
  await shot("2-game.png");

  /* -------------------------------------------------- panels open / close */
  const panels = [
    ["b", ".build-panel"],
    ["i", ".inv-panel"],
    ["m", ".map-panel"],
    ["h", ".help-panel"],
  ];
  for (const [key, sel] of panels) {
    await page.keyboard.press(key);
    await page.waitForSelector(sel, { timeout: 5000 });
    await page.keyboard.press("Escape");
    await page.waitForSelector(sel, { state: "detached", timeout: 5000 });
    check(`panel '${key}' opens and closes`, true);
  }

  /* -------------------------------------------------------------- movement */
  const dotPos = async () => {
    await page.keyboard.press("m");
    await page.waitForSelector(".map-panel", { timeout: 5000 });
    const pos = await page.$eval(".map-dot.player", (el) => ({
      left: el.style.left,
      top: el.style.top,
    }));
    await page.keyboard.press("Escape");
    await page.waitForSelector(".map-panel", { state: "detached", timeout: 5000 });
    return pos;
  };
  const before = await dotPos();
  await page.keyboard.down("w");
  await page.waitForTimeout(2500);
  await page.keyboard.up("w");
  const after = await dotPos();
  check(
    "player moves while W is held",
    before.left !== after.left || before.top !== after.top,
    `${JSON.stringify(before)} -> ${JSON.stringify(after)}`
  );

  /* ----------------------------------------------------------- error sweep */
  check("no page/console errors", errors.length === 0, errors.slice(0, 6).join(" | "));
  await shot("3-after-move.png");
} catch (err) {
  check("verification completed", false, err.message.split("\n")[0]);
  try {
    await page.screenshot({ path: `${SHOTS}/failure.png`, timeout: 30000 });
  } catch {
    /* page may be gone */
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (errors.length) console.log("collected errors:\n  " + errors.join("\n  "));
process.exit(failed.length ? 1 : 0);
