// Drives the running Fictulary web app (see start.sh) in headless Chromium.
// Reads one command per line from stdin; `help` lists them. Screenshots go
// to out/<name>.png next to this file.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:4300';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
const TOKEN_KEY = 'fictulary.accessToken';

/** Playwright's own Chromium, or the newest one in its download cache. */
function chromePath() {
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  const cache = join(homedir(), '.cache/ms-playwright');
  const builds = existsSync(cache)
    ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort()
    : [];
  for (const build of builds.reverse()) {
    const path = join(cache, build, 'chrome-linux64/chrome');
    if (existsSync(path)) return path;
  }
  throw new Error('No Chromium; run: npx playwright-core install chromium');
}

const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
let page = await context.newPage();
const errors = [];
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
};
watch(page);
context.on('page', watch);

const path = () => page.url().replace(BASE, '') || '/';
/** An ion-input's native input, by its formControlName. */
const field = (name) => page.locator(`ion-input[formcontrolname=${name}] input`);
/** Ionic animates overlays; screenshots taken mid-fade look half-empty. */
const settle = () => page.waitForTimeout(600);

const commands = {
  help: () => console.log(Object.keys(commands).join(' ')),
  nav: async (url) => {
    await page.goto(new URL(url, BASE).href);
    await page.waitForLoadState('networkidle');
  },
  // Signs in through POST /api/auth/dev without the UI; reloads the page.
  signin: async (email, ...name) => {
    if (page.url() === 'about:blank') await page.goto(BASE);
    const body = { email, ...(name.length && { name: name.join(' ') }) };
    const token = await page.evaluate(async (b) => {
      const res = await fetch('/api/auth/dev', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(b),
      });
      if (!res.ok) throw new Error(`dev sign-in: ${res.status} ${await res.text()}`);
      return (await res.json()).accessToken;
    }, body);
    await page.evaluate(([k, t]) => localStorage.setItem(k, t), [TOKEN_KEY, token]);
    await page.reload();
    await page.waitForLoadState('networkidle');
  },
  signout: async () => {
    await page.evaluate((k) => localStorage.removeItem(k), TOKEN_KEY);
    await page.reload();
  },
  // Clicks the first visible element whose text is exactly this.
  click: (...text) =>
    page.getByText(text.join(' '), { exact: true }).locator('visible=true').first().click(),
  // Raw Playwright selector, e.g. `ion-alert button:has-text("Delete account")`.
  'click-css': (...selector) => page.locator(selector.join(' ')).first().click(),
  fill: (name, ...value) => field(name).fill(value.join(' ')),
  wait: (...text) =>
    page.getByText(text.join(' ')).locator('visible=true').first().waitFor({ timeout: 15000 }),
  'wait-url': (pattern) => page.waitForURL(`**${pattern}`, { timeout: 15000 }),
  url: () => console.log(path()),
  text: async (...selector) =>
    console.log((await page.locator(selector.join(' ') || 'ion-router-outlet').first().innerText()).trim()),
  shot: async (name = 'screenshot') => {
    await settle();
    const file = join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  },
  // Switches to the most recently opened tab or popup (e.g. Google sign-in).
  'last-page': async () => {
    await page.waitForTimeout(1500);
    page = context.pages().at(-1);
    console.log(page.url().slice(0, 120));
  },
  eval: async (...js) => console.log(await page.evaluate(js.join(' '))),
  // Resizes the page, e.g. `viewport 360 640` for a small phone.
  viewport: (width, height) =>
    page.setViewportSize({ width: Number(width), height: Number(height) }),
  sleep: (ms) => page.waitForTimeout(Number(ms)),
  errors: () => console.log(errors.length ? errors.join('\n') : 'no console errors'),
};

let failed = false;
for await (const line of createInterface({ input: process.stdin })) {
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name || name.startsWith('#')) continue;
  const run = commands[name];
  try {
    if (!run) throw new Error(`unknown command; try: help`);
    await run(...args);
    console.log(`ok   ${line.trim()}  [${path()}]`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${line.trim()}  [${path()}]\n     ${String(error.message ?? error).split('\n')[0]}`);
    if (process.env.KEEP_GOING !== '1') break;
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
