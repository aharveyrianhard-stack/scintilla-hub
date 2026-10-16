/* CW2 · GET-only reads of the Hub's database the Hub's own way: PostgREST with the anon key read from the live release's index.html. Never prints the key. */
import fs from "node:fs";
const HUB = "/Users/alanharvey/SCINTILLA 0.5/_deploy/hub-deploy/index.html";
const src = fs.readFileSync(HUB, "utf8");
const m = src.match(/SC_ANON_KEY\)\s*\|\|\s*"(eyJ[^"]+)"/);
if (!m) throw new Error("anon key not found in index.html");
export const KEY = m[1];
export const SB = "https://wadinxqplrggagkvrdag.supabase.co/rest/v1";
export const sbGet = async (p) => { const r = await fetch(SB + "/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (r.status !== 200) throw new Error(p.slice(0, 120) + " → " + r.status + " " + (await r.text()).slice(0, 200)); return r.json(); };
export const paged = async (base, step = 1000) => { const all = []; for (let off = 0; off < 200000; off += step) { const page = await sbGet(`${base}&limit=${step}&offset=${off}`); all.push(...page); if (page.length < step) break; } return all; };
