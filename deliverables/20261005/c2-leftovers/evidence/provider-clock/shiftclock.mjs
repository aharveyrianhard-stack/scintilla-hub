// test-only: makes "now" start at C2_NOW (ISO) and tick normally from there
const target = Date.parse(process.env.C2_NOW); const off = target - Date.now(); const R = Date
class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a) } static now() { return R.now() + off } }
globalThis.Date = D
