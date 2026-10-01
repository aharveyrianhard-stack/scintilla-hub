import { chromium, EXE } from "./rig.mjs";
const [file, out, W] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await (await b.newContext({ viewport: { width: +W, height: 1000 } })).newPage();
await p.goto("file://" + file); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => ({ h: document.body.scrollHeight, broken: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")), overflow: document.documentElement.scrollWidth > innerWidth }))));
await p.screenshot({ path: out, fullPage: false }); await b.close();
