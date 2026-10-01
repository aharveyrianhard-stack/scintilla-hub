// H3 frames — load the Hub (local file) once, then every STEP ms record which ECONOMIC face is on screen and clip a shot of
// the top strip. usage: node frames.mjs <index.html> <outDir> <width> <count> <stepMs>
import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs";
const [file, dir, W, N, STEP] = process.argv.slice(2);
const html = fs.readFileSync(file), width = +W || 1680;
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1050 }, deviceScaleFactor: width < 600 ? 2 : 1, isMobile: width < 600, hasTouch: width < 600 });
await context.route("**/*", (route) => { const req = route.request(), u = new URL(req.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
  if (u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html")) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  return route.continue(); });
const page = await context.newPage();
await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("#macroNext .mn-face"), null, { timeout: 60000 });
const seq = [];
for (let i = 0; i < +N; i++) {
  const r = await page.evaluate(() => { const t = document.querySelector("#topTape"), b = t.getBoundingClientRect(), f = document.querySelector("#macroNext .mn-face.on");
    return { at: new Date().toISOString().slice(11, 19), on: f ? f.textContent : null, clip: { x: b.left, y: b.top, width: b.width, height: b.height } }; });
  seq.push({ at: r.at, on: r.on });
  if (i < 14) await page.screenshot({ path: dir + "/f" + String(i).padStart(2, "0") + ".png", clip: r.clip });
  await sleep(+STEP);
}
console.log(JSON.stringify(seq));
await browser.close();
