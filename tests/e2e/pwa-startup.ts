import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, webkit, type Page } from 'playwright';
import { gate, localStagingEnvironment, requireStagingConfig } from '../../scripts/staging-hosted-config.js';

const baseline = process.argv.includes('--baseline');
const { origin, password } = requireStagingConfig(localStagingEnvironment());
const output = 'output/playwright/pwa-startup';
mkdirSync(output, { recursive: true });

async function watchStartup(page: Page) {
  await page.addInitScript(() => {
    const marks: Record<string, number> = {};
    Object.assign(window, { startupMarks: marks });
    new MutationObserver(() => {
      if (!marks.shell && document.querySelector('.bottom-nav')) marks.shell = performance.now();
      if (!marks.authenticated && document.querySelector('[data-owner-session="authenticated"]')) marks.authenticated = performance.now();
      if (!marks.emptyData && document.querySelector('[data-today-setup-prompt]')) marks.emptyData = performance.now();
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
}

async function timings(page: Page) {
  return page.evaluate(() => ({
    marks: (window as unknown as { startupMarks: Record<string, number> }).startupMarks,
    paint: performance.getEntriesByType('paint').map(entry => ({ name: entry.name, ms: entry.startTime })),
    resources: performance.getEntriesByType('resource').map(entry => {
      const resource = entry as PerformanceResourceTiming;
      return { path: new URL(entry.name).pathname, ms: Math.round(entry.duration), bytes: resource.transferSize };
    })
  }));
}

async function run() {
  if (process.argv.includes('--upgrade')) return verifyExistingInstallUpgrade();
  if (process.argv.includes('--contract')) return verifyPendingSession();
  for (const engine of [chromium, webkit]) {
    if (process.argv.includes('--webkit') && engine !== webkit) continue;
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
    try {
      const login = await context.request.post(`${origin}/api/v1/auth/login`, { headers: { origin }, data: { password } });
      gate(login.status() === 204, 'startup owner login');
      for (const mode of ['cold', 'installed', 'reopen']) {
        const page = await context.newPage();
        const responses: { path: string; status: number }[] = [];
        const errors: string[] = [];
        page.on('response', response => responses.push({ path: new URL(response.url()).pathname, status: response.status() }));
        page.on('pageerror', error => errors.push(error.message));
        await watchStartup(page);
        await page.goto(origin);
        await page.locator('.bottom-nav').waitFor();
        try {
          await page.locator('[data-today-setup-prompt]').waitFor({ timeout: 30000 });
        } catch (error) {
          await page.screenshot({ path: `${output}/failure-${engine.name()}-${mode}.png` });
          console.log(JSON.stringify({ engine: engine.name(), mode, responses, errors, ...await timings(page),
            state: await page.locator('#app-root').getAttribute('data-owner-session'),
            tab: await page.locator('#main-scroll').getAttribute('data-active-tab').catch(() => null) }));
          throw error;
        }
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
        const result = { engine: engine.name(), mode, baseline, ...await timings(page) };
        writeFileSync(`${output}/${baseline ? 'baseline' : 'candidate'}-${engine.name()}-${mode}.json`, JSON.stringify(result, null, 2));
        console.log(JSON.stringify({ ...result, resources: result.resources.length }));
        if (mode === 'installed') await page.screenshot({ path: `${output}/${baseline ? 'baseline' : 'candidate'}-${engine.name()}.png` });
        await page.close();
      }
      if (!baseline && engine === chromium) {
        const page = await context.newPage();
        await watchStartup(page);
        await context.setOffline(true);
        await page.goto(`${origin}/?tab=matches`);
        await page.locator('.bottom-nav').waitFor({ timeout: 1500 });
        assert.equal(await page.locator('#main-scroll').getAttribute('data-active-tab'), 'matches');
        await page.locator('.bottom-nav [data-tab-target="bets"]').click();
        assert.equal(await page.locator('#main-scroll').getAttribute('data-active-tab'), 'bets');
        assert.equal(await page.locator('[data-owner-session="authenticated"]').count(), 0);
        await page.screenshot({ path: `${output}/offline-${engine.name()}.png` });
        console.log(JSON.stringify({ gate: 'offline-startup', engine: engine.name(), ...await timings(page) }));
        await page.close();
        await context.setOffline(false);
      }
      if (!baseline && engine === webkit) {
        console.log(JSON.stringify({ gate: 'offline-startup', engine: 'webkit', status: 'unsupported-on-host',
          reason: 'Windows WebKit offline navigation also fails with a minimal independent classic/module service worker; actual iOS offline launch remains unverified.' }));
      }
    } finally {
      await context.setOffline(false);
      await context.request.post(`${origin}/api/v1/auth/logout`, { headers: { origin } });
      await context.close();
      await browser.close();
    }
  }
}

async function verifyExistingInstallUpgrade() {
  await Promise.all([chromium, webkit].map(async engine => {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    try {
      const login = await context.request.post(`${origin}/api/v1/auth/login`, { headers: { origin }, data: { password } });
      gate(login.status() === 204, 'existing-install owner login');
      const page = await context.newPage();
      await page.goto(origin);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      assert.deepEqual(await page.evaluate(() => caches.keys()), ['miraichi-shell-v13-daily-live']);
      await page.evaluate(() => Object.assign(window, { previousPwaController: navigator.serviceWorker.controller }));
      console.log(JSON.stringify({ gate: 'upgrade-old-install-ready', engine: engine.name() }));
      const deadline = Date.now() + 15 * 60_000;
      let deployed = false;
      while (Date.now() < deadline) {
        const script = await context.request.get(`${origin}/service-worker.js`);
        if ((await script.text()).includes('miraichi-shell-v15-structured-add-bet')) { deployed = true; break; }
        await delay(5000);
      }
      assert.ok(deployed, 'new worker must be deployed within upgrade test window');
      await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
      await page.waitForFunction(() => {
        const previous = (window as unknown as { previousPwaController: ServiceWorker }).previousPwaController;
        return navigator.serviceWorker.controller !== previous && navigator.serviceWorker.controller?.state === 'activated';
      });
      // Opening the new cache happens at install start; activation must finish before going offline.
      await page.waitForFunction(async () => {
        const names = await caches.keys();
        return names.length === 1 && names[0] === 'miraichi-shell-v15-structured-add-bet';
      });
      await page.waitForFunction(async () => (await (await fetch('/')).text()).includes('data-owner-session="pending"'));
      if (engine === chromium) await context.setOffline(true);
      await page.goto(`${origin}/?tab=matches`);
      assert.equal(await page.locator('.bottom-nav').count(), 1);
      await page.locator('.bottom-nav [data-tab-target="bankroll"]').click();
      assert.equal(await page.locator('#main-scroll').getAttribute('data-active-tab'), 'bankroll');
      assert.deepEqual(await page.evaluate(() => caches.keys()), ['miraichi-shell-v15-structured-add-bet']);
      await page.screenshot({ path: `${output}/upgraded-${engine.name()}.png` });
      const result = { gate: 'existing-install-upgrade', engine: engine.name(), offline: engine === chromium,
        status: 'passed', at: new Date().toISOString() };
      writeFileSync(`${output}/upgrade-${engine.name()}.json`, JSON.stringify(result));
      console.log(JSON.stringify(result));
    } finally {
      await context.setOffline(false);
      await context.request.post(`${origin}/api/v1/auth/logout`, { headers: { origin } });
      await context.close(); await browser.close();
    }
  }));
}

async function verifyPendingSession() {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let releaseSession: () => void = () => undefined;
    const heldSession = new Promise<void>(resolve => { releaseSession = resolve; });
    try {
      const login = await context.request.post(`${origin}/api/v1/auth/login`, { headers: { origin }, data: { password } });
      gate(login.status() === 204, 'pending-session owner login');
      const page = await context.newPage();
      if (process.argv.includes('--local')) {
        await page.route('**/*', async route => {
          const pathname = new URL(route.request().url()).pathname;
          if (pathname.startsWith('/api/')) return route.continue();
          const directory = path.resolve('apps/web/dist');
          const file = path.resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
          assert.ok(file.startsWith(`${directory}${path.sep}`));
          try {
            const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/json';
            await route.fulfill({ status: 200, contentType: type, body: readFileSync(file) });
          } catch { await route.fulfill({ status: 404 }); }
        });
      }
      let pending = true;
      const premature: string[] = [];
      page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (pending && path.startsWith('/api/') && path !== '/api/v1/auth/session') premature.push(path);
      });
      await page.route('**/api/v1/auth/session', async route => { await heldSession; await route.continue(); });
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('.bottom-nav').count(), 1, 'shell must render while session is still held');
      assert.equal(await page.locator('#main-scroll').getAttribute('inert'), '');
      for (const tab of ['matches', 'bets', 'bankroll']) {
        await page.locator(`.bottom-nav [data-tab-target="${tab}"]`).click();
        assert.equal(await page.locator('#main-scroll').getAttribute('data-active-tab'), tab);
      }
      assert.deepEqual(premature, [], 'pending shell makes no private or live requests');
      pending = false;
      releaseSession();
      await page.locator('[data-owner-session="authenticated"]').waitFor();
      assert.equal(await page.locator('#main-scroll').getAttribute('data-active-tab'), 'bankroll', 'authentication preserves chosen tab');
      assert.equal(await page.locator('#main-scroll').getAttribute('inert'), null);
      await context.request.post(`${origin}/api/v1/auth/logout`, { headers: { origin } });
      await page.reload();
      await page.locator('[data-owner-login-form]').waitFor();
      assert.equal(await page.locator('.bottom-nav').count(), 0, 'expired session shows login');
      await page.route('**/api/v1/auth/session', route => route.abort('failed'));
      await page.reload();
      await page.locator('[data-owner-retry]').waitFor();
      assert.equal(await page.locator('.bottom-nav').count(), 1, 'network failure retains data-free shell');
      await page.route('**/api/v1/auth/session', route => route.continue());
      await page.locator('[data-owner-retry]').click();
      await page.locator('[data-owner-login-form]').waitFor();
      console.log(JSON.stringify({ gate: 'pending-and-expired-session', engine: engine.name(), status: 'passed' }));
    } finally {
      releaseSession();
      await context.close();
      await browser.close();
    }
  }
}

void run().catch(error => { console.error(error instanceof Error ? error.message : 'PWA startup failed'); process.exitCode = 1; });
