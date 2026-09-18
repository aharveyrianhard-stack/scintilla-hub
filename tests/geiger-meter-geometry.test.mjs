import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// Stroke-inclusive extents of an SVG large-arc "M x1,y1 A r,r,0,1,1,x2,y2" drawn over the top (round caps).
function arcExtents(d, strokeWidth) {
  const m = d.match(/M([\d.]+),([\d.]+) A([\d.]+),[\d.]+,0,1,1,([\d.]+),([\d.]+)/);
  const [x1, y1, r, x2] = [m[1], m[2], m[3], m[4]].map(Number);
  const cx = (x1 + x2) / 2, cy = y1 - Math.sqrt(r * r - ((x2 - x1) / 2) ** 2), h = strokeWidth / 2;
  return { top: cy - r - h, bottom: y1 + h, left: cx - r - h, right: cx + r + h };
}

test("GEIGER tab composite rings sit wholly inside the meter viewBox (no clipped ends)", () => {
  const svg = page.match(/'<svg width="100%" height="100%" viewBox="([\d. ]+)" preserveAspectRatio="xMidYMid meet" fill="none" style="max-height:150px">' \+([\s\S]*?)'<\/svg>'/);
  assert.ok(svg, "meter svg present");
  const [vx, vy, vw, vh] = svg[1].split(" ").map(Number);
  assert.deepEqual([vw, vh], [340, 240], "same window size, so the rings render at the same scale as before");
  const paths = [...svg[2].matchAll(/d="(M[^"]+)"[^>]*stroke-width="(\d+)"/g)];
  assert.equal(paths.length, 4, "two tracks + two fills (trend, momentum)");
  for (const [, d, sw] of paths) {
    const e = arcExtents(d, +sw);
    assert.ok(e.top >= vy && e.bottom <= vy + vh && e.left >= vx && e.right <= vx + vw,
      `ring ${d.slice(0, 22)} extents ${JSON.stringify(e)} exceed viewBox ${svg[1]}`);
  }
});
