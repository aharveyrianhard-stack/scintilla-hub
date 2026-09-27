/* D1 — local preview server for the mockups. Serves the Hub worktree as the site root, and forwards
   GET /__chart/<path> to the chart API with Origin: https://scintillahub.ai, because the API only accepts that
   origin (common brief). GET only: nothing is written anywhere. On scintillahub.ai the pages call the API directly.
   node serve.mjs [port] */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const API = "https://scintilla-massive-chart-api.fly.dev";
const PORT = +(process.argv[2] || 8791);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
let apiCalls = 0;
createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/__stats") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ apiCalls })); }
    if (u.pathname.startsWith("/__chart/")) {
      apiCalls++;
      const r = await fetch(API + u.pathname.slice(8) + u.search, { headers: { Origin: "https://scintillahub.ai" } });
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json", "cache-control": "no-store" });
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if ((await stat(p).catch(() => null))?.isDirectory()) p = path.join(p, "index.html");
    const body = await readFile(p);
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("not found"); }
}).listen(PORT, "127.0.0.1", () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
