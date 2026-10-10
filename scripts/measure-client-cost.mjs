// Misst pro Seite das geladene JavaScript und die Rechenzeit im Browser (lange Tasks) –
// auf einem gedrosselten „Handy“ (4× CPU), angemeldet über den Test-Login.
// Aufruf: node scripts/measure-client-cost.mjs [--role member] /mitglieder /mitglieder/lager …
import {
  createAuthedContext,
  launchBrowser,
  loadE2EEnv,
  resolveBaseURL,
  VIEWPORTS,
  waitForPageReady,
} from "./lib/e2e-session.mjs";

loadE2EEnv();
const args = process.argv.slice(2);
const roleIndex = args.indexOf("--role");
const role = roleIndex >= 0 ? args.splice(roleIndex, 2)[1] : "member";
const routes = args.length ? args : ["/mitglieder"];
const baseURL = resolveBaseURL();

const browser = await launchBrowser();
const context = await createAuthedContext(browser, {
  baseURL,
  role,
  secret: process.env.E2E_LOGIN_SECRET ?? "",
  viewport: VIEWPORTS.mobile,
});
await context.addInitScript(() => {
  window.__longTasks = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__longTasks.push(entry.duration);
  }).observe({ type: "longtask", buffered: true });
});

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
console.log(
  "Seite | JS (übertragen) | JS (entpackt) | Dateien | lange Tasks | Blockiert (TBT) | längste",
);
for (const route of routes) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(route, { waitUntil: "load" });
  await waitForPageReady(page, { route });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const scripts = performance
      .getEntriesByType("resource")
      .filter((entry) => entry.initiatorType === "script" || entry.name.endsWith(".js"));
    const tasks = window.__longTasks;
    return {
      transfer: scripts.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
      decoded: scripts.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
      files: scripts.length,
      longTasks: tasks.length,
      tbt: tasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0),
      longest: tasks.length ? Math.max(...tasks) : 0,
    };
  });
  console.log(
    `${route} | ${kb(result.transfer)} | ${kb(result.decoded)} | ${result.files} | ${result.longTasks} | ${Math.round(result.tbt)} ms | ${Math.round(result.longest)} ms`,
  );
  await page.close();
}
await browser.close();
