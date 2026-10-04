import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium, webkit, type BrowserType, type Page } from 'playwright';
import { renderAppShell } from '../../apps/web/src/components/app-shell.js';
import { localStagingEnvironment, requireStagingConfig, gate } from '../../scripts/staging-hosted-config.js';

const hosted = process.argv.includes('--staging');
const output = 'output/playwright/pwa-tabbar';
const cases = [
  { name: 'small', width: 320, height: 568, bottom: 0, side: 0 },
  { name: 'portrait', width: 390, height: 844, bottom: 34, side: 0 },
  { name: 'short-viewport', width: 390, height: 664, bottom: 34, side: 0 },
  { name: 'landscape', width: 844, height: 390, bottom: 21, side: 47 },
  { name: 'desktop', width: 1280, height: 900, bottom: 0, side: 0 }
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('.bottom-nav')!;
    const scroll = document.querySelector<HTMLElement>('.main-scroll')!;
    const shell = document.querySelector<HTMLElement>('.app-shell')!;
    const rect = nav.getBoundingClientRect();
    const style = getComputedStyle(nav);
    const firstField = document.querySelector<HTMLElement>('.field-input');
    const buttons = [...nav.querySelectorAll('button')].map((button) => {
      const box = button.getBoundingClientRect();
      return { height: box.height, left: box.left, right: box.right, bottom: box.bottom };
    });
    return {
      viewport: innerHeight, bottom: rect.bottom, height: rect.height, top: rect.top,
      paddingBottom: parseFloat(style.paddingBottom), shellHeight: shell.getBoundingClientRect().height,
      scrollPadding: parseFloat(getComputedStyle(scroll).paddingBottom),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      formControlFontSize: firstField ? parseFloat(getComputedStyle(firstField).fontSize) : 0,
      touchAction: getComputedStyle(document.documentElement).touchAction,
      buttons
    };
  });
}

async function run() {
  mkdirSync(output, { recursive: true });
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let origin: string | undefined;
    try {
      if (hosted) {
        const config = requireStagingConfig(localStagingEnvironment());
        origin = config.origin;
        const login = await context.request.post(`${origin}/api/v1/auth/login`, {
          headers: { origin }, data: { password: config.password }
        });
        gate(login.status() === 204, 'PWA layout owner login');
        await page.goto(origin);
        await page.locator('.bottom-nav').waitFor();
        assert.equal(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content'), 'black');
        assert.equal((await measure(page)).bottom, 844, 'unmodified hosted viewport anchors to bottom');
      } else {
        const css = readFileSync('packages/ui/src/index.css', 'utf8');
        await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"><style>${css}</style><div id="app-root">${renderAppShell()}</div>`);
      }
      for (const scenario of cases) {
        await page.setViewportSize({ width: scenario.width, height: scenario.height });
        // Synthetic insets exercise CSS arithmetic; desktop WebKit is not an iOS PWA.
        await page.evaluate(({ bottom, side }) => {
          const root = document.documentElement.style;
          root.setProperty('--safe-bottom', `${bottom}px`);
          root.setProperty('--safe-left', `${side}px`);
          root.setProperty('--safe-right', `${side}px`);
        }, scenario);
        const actual = await measure(page);
        const label = `${engine.name()} ${scenario.name}`;
        assert.equal(actual.bottom, scenario.height, `${label}: nav touches viewport bottom`);
        assert.equal(actual.height - actual.paddingBottom - 1, 49, `${label}: compact control row`);
        assert.equal(actual.paddingBottom, scenario.bottom, `${label}: safe area applied once`);
        assert.ok(Math.abs(actual.shellHeight - scenario.height) < 0.5, `${label}: shell follows resized viewport (subpixel rounding)`);
        assert.ok(actual.scrollPadding >= actual.height + 16, `${label}: last content clears navigation`);
        assert.equal(actual.horizontalOverflow, false, `${label}: no horizontal overflow`);
        assert.ok(['pan-x pan-y', 'pan-y pan-x'].includes(actual.touchAction), `${label}: pinch gesture excluded by CSS`);
        if (scenario.width <= 900) assert.ok(actual.formControlFontSize >= 16, `${label}: form controls avoid iOS focus zoom`);
        assert.equal(actual.buttons.length, 4);
        for (const button of actual.buttons) {
          assert.ok(button.height >= 44, `${label}: touch target`);
          assert.ok(button.bottom <= scenario.height - scenario.bottom, `${label}: home indicator clearance`);
          assert.ok(button.left >= scenario.side && button.right <= scenario.width - scenario.side, `${label}: landscape clearance`);
        }
        if (hosted) {
          for (const tab of ['today', 'matches', 'bets', 'bankroll']) {
            await page.locator(`.bottom-nav [data-tab-target="${tab}"]`).click();
            assert.equal((await measure(page)).bottom, scenario.height, `${label}: ${tab} anchoring`);
          }
          await page.locator('.bottom-nav [data-tab-target="matches"]').click();
        }
        await page.screenshot({ path: `${output}/${hosted ? 'staging' : 'local'}-${engine.name()}-${scenario.name}.png` });
        console.log(JSON.stringify({ gate: 'pwa-layout', target: hosted ? 'staging' : 'local', engine: engine.name(), scenario: scenario.name, ...actual }));
      }
      // Scroll a long fixture to its final item to prove it remains above the tabbar.
      await page.evaluate(() => {
        const scroll = document.querySelector<HTMLElement>('.main-scroll')!;
        scroll.innerHTML = '<div style="height:2000px"></div><button id="pwa-last-item">Last item</button>';
        scroll.scrollTop = scroll.scrollHeight;
      });
      const last = await page.locator('#pwa-last-item').boundingBox();
      assert.ok(last && last.y + last.height <= (await measure(page)).top, 'scrolled final item clears tabbar');
    } finally {
      if (origin) await context.request.post(`${origin}/api/v1/auth/logout`, { headers: { origin } });
      await context.close();
      await browser.close();
    }
  }
  if (hosted) {
    for (const engine of [chromium, webkit]) await verifyInstalledCache(engine);
  }
}

async function verifyInstalledCache(engine: BrowserType) {
  const { origin } = requireStagingConfig(localStagingEnvironment());
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const page = await context.newPage();
    await page.goto(origin);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const cached = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const names = await caches.keys();
      const cache = await caches.open('miraichi-shell-v17-manual-add');
      return { names, css: await (await cache.match('/packages/ui/src/index.css'))?.text(),
        html: await (await cache.match('/'))?.text() };
    });
    assert.deepEqual(cached.names, ['miraichi-shell-v17-manual-add'], 'active installed shell cache');
    assert.equal(cached.css, readFileSync('apps/web/dist/packages/ui/src/index.css', 'utf8'), 'cached CSS equals deployed build');
    assert.ok(cached.html?.includes('name="apple-mobile-web-app-status-bar-style" content="black"'));
    await page.reload();
    const css = await page.evaluate(async () => (await fetch('/packages/ui/src/index.css')).text());
    assert.equal(css, cached.css, 'controlled reload serves current CSS');
    console.log(JSON.stringify({ gate: 'pwa-cache', status: 'passed', engine: engine.name(), cache: cached.names[0] }));
  } finally {
    await context.close();
    await browser.close();
  }
}

void run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'PWA layout failed'); process.exitCode = 1; });
