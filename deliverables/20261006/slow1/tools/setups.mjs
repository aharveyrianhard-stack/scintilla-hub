export async function hubBoardFs(page) {
  const b = page.locator('#boardPanel [data-act="secfs"]').first();
  await b.waitFor({ timeout: 20000 }); await b.click(); await page.waitForTimeout(2000);
  return await page.evaluate(() => "body=" + document.body.className + " fs=" + [...document.querySelectorAll(".sc-secfs")].map((x) => x.id).join(",") + " rows=" + document.querySelectorAll("#boardScroll > *").length);
}
export async function stationBusiest(page) {
  for (let i = 0; i < 4; i++) { await page.locator("#edgeNext").click({ force: true }); await page.waitForTimeout(3500); }
  return await page.evaluate(() => "iframes=" + document.querySelectorAll("iframe").length + " charts=" + [...document.querySelectorAll("iframe")].filter((f) => /chart-v1/.test(f.src) && f.getBoundingClientRect().width > 5).length);
}
