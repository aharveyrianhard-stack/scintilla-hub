import fs from "node:fs"; import { sbGet } from "./sb.mjs";
const S = process.env.S;
const radar = await sbGet("station_lists?select=list,position,ticker&list=eq.radar&order=position.asc");
fs.writeFileSync(S + "/db/radar.json", JSON.stringify({ read_utc: new Date().toISOString(), rows: radar }, null, 1));
console.log("RADAR", radar.length, radar.map((r) => r.ticker).join(" "));
