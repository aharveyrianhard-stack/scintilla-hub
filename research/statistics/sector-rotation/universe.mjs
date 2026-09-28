/* U2 · SECTOR ROTATION — the fund universe, in the Hub's SECT order (index.html SECT / SECT_FAMILY_FUNDS):
   MATERIALS ENERGY FINANCIALS INDUSTRIAL TECH STAPLES REAL EST UTILITIES HEALTH DISCRET COMMS. */
export const SECTORS = ["MATERIALS", "ENERGY", "FINANCIALS", "INDUSTRIAL", "TECH", "STAPLES", "REAL EST", "UTILITIES", "HEALTH", "DISCRET", "COMMS"];
export const FAMILIES = {
  SPDR: ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY", "XLC"],
  ISHARES: ["IYM", "IYE", "IYF", "IYJ", "IYW", "IYK", "IYR", "IDU", "IYH", "IYC", "IYZ"],
  VANGUARD: ["VAW", "VDE", "VFH", "VIS", "VGT", "VDC", "VNQ", "VPU", "VHT", "VCR", "VOX"],
  EQWT: ["RSPM", "RSPG", "RSPF", "RSPN", "RSPT", "RSPS", "RSPR", "RSPU", "RSPH", "RSPD", "RSPC"],
};
export const BENCH = ["SPY", "RSP"];
export const ALL_SYMS = [...BENCH, ...Object.values(FAMILIES).flat()];
export const sectorOf = (sym) => { for (const f of Object.values(FAMILIES)) { const i = f.indexOf(sym); if (i >= 0) return SECTORS[i]; } return null; };
