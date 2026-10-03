/* T10 (2 Oct, late night) · the tickers as ONE texture: every tradeable's ticker painted once into a tile of a 2048 × 2048
   canvas, white on nothing, so a bar's shader and a step's material can paint the ticker ON the thing itself. The label is
   then part of the box or the step and moves with it — no DOM label floating over the scene, no billboard, nothing to
   "vibrate" when the view turns (Alan, 2 Oct: "the label should be right on the step … moving things around in 3D makes the
   labels vibrate"). A tile is 128 × 40 px (3.2 : 1, the box's own shape); the word is drawn as large as the tile allows
   (its height 0.7 of the tile, the standard's bar : ticker ratio) and centred. tileOf(ticker) = the tile's index; the
   shader turns the index into UV. widthPx(ticker, px) = the word's width at a type size, for "does it fit on the box". */
import * as THREE from "three";
export const TILE = { w: 128, h: 40, cols: 16, rows: 51 };
export function buildAtlas(tickers) {
  const c = document.createElement("canvas"); c.width = TILE.cols * TILE.w; c.height = TILE.rows * TILE.h;
  const x = c.getContext("2d");
  x.clearRect(0, 0, c.width, c.height);
  const index = new Map(), widths = new Map();
  const list = [...new Set(tickers.filter(Boolean))].slice(0, TILE.cols * TILE.rows);
  const FONT = (px) => `700 ${px}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  list.forEach((t, i) => {
    const col = i % TILE.cols, row = Math.floor(i / TILE.cols), x0 = col * TILE.w, y0 = row * TILE.h;
    let px = Math.round(TILE.h * 0.7); x.font = FONT(px); let w = x.measureText(t).width;
    if (w > TILE.w - 8) { px = Math.floor(px * (TILE.w - 8) / w); x.font = FONT(px); w = x.measureText(t).width; } // a long ticker shrinks to fit the tile
    x.textAlign = "center"; x.textBaseline = "middle";
    x.shadowColor = "rgba(0,0,0,0.9)"; x.shadowBlur = 3; x.fillStyle = "#fff";
    x.fillText(t, x0 + TILE.w / 2, y0 + TILE.h / 2 + 1);
    index.set(t, i); widths.set(t, w / px); // width in em
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapNearestFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = 1; tex.needsUpdate = true; // plain filtering: software GL (the headless proof) crawls on anisotropic trilinear sampling
  return { texture: tex, tileOf: (t) => (index.has(t) ? index.get(t) : -1), emWidth: (t) => widths.get(t) || 2.4, count: list.length };
}
