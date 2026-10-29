import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
const require = createRequire(resolve(process.env.BG_REPRO_PACKAGE || 'package.json'));
const { chromium } = require('playwright');
const output = resolve(process.env.BG_REPRO_OUTPUT || 'native-context-lifecycle.json');
fs.mkdirSync(dirname(output), { recursive: true });
const deadlineMs = 30_000;
const result = { started: new Date().toISOString(), platform: process.platform, arch: process.arch, os: os.release(), node: process.version, playwright: require('playwright/package.json').version, defaultExecutablePath: chromium.executablePath(), iterationsPerArm: 16, deadlineMs, retries: 0, modes: ['no-worker', 'minimal-worker'], cases: [], errors: [], cleanup: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(result, null, 2));
async function bounded(name, action) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name}: diagnostic deadline ${deadlineMs}ms exceeded`)), deadlineMs); })]); }
  finally { clearTimeout(timer); }
}
async function cleanup(name, action) {
  try { await bounded(name, action); result.cleanup.push({ name, status: 'passed' }); }
  catch (error) { result.cleanup.push({ name, status: 'failed', error: String(error.stack || error) }); result.errors.push(`${name}: ${String(error)}`); }
}
const server = http.createServer((req, res) => {
  if (req.url === '/sw.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));"); }
  else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>Native context lifecycle diagnostic</title><p>No Big Gains application</p>'); }
});
let browser;
save();
try {
  await bounded('server.listen', () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await bounded('chromium.launch', () => chromium.launch({ timeout: deadlineMs }));
  result.version = browser.version();
  for (const mode of result.modes) {
    for (let index = 0; index < result.iterationsPerArm; index++) {
      const cell = { mode, index, beforeFreeMemory: os.freemem(), started: new Date().toISOString(), contexts: 0, closed: 0, operations: [] };
      const owned = [];
      const op = async (name, action) => { cell.operations.push({ name, event: 'begin', epoch: Date.now() }); const value = await bounded(name, action); cell.operations.push({ name, event: 'complete', epoch: Date.now() }); return value; };
      try {
        const a = await op('context-a-create', () => browser.newContext({ baseURL: origin })); owned.push(a); cell.contexts++;
        const b = await op('context-b-create', () => browser.newContext({ baseURL: origin })); owned.push(b); cell.contexts++;
        const pa = await op('page-a-create', () => a.newPage());
        await op('page-a-navigation', () => pa.goto('/', { timeout: deadlineMs }));
        await op('page-a-storage', () => pa.evaluate(() => localStorage.setItem('identity', 'a')));
        const pb = await op('page-b-create', () => b.newPage());
        await op('page-b-navigation', () => pb.goto('/', { timeout: deadlineMs }));
        if (await op('page-b-isolation', () => pb.evaluate(() => localStorage.getItem('identity'))) !== null) throw new Error('context isolation failed');
        if (mode === 'minimal-worker') await op('minimal-worker-ready', () => pb.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; }));
        await op('context-a-close', () => a.close()); cell.closed++;
        await op('context-b-close', () => b.close()); cell.closed++;
        const c = await op('context-successor-create', () => browser.newContext({ viewport: { width: 375, height: 812 }, baseURL: origin })); owned.push(c); cell.contexts++;
        const pc = await op('page-successor-create', () => c.newPage());
        await op('page-successor-navigation', () => pc.goto('/', { timeout: deadlineMs }));
        if (await op('page-successor-isolation', () => pc.evaluate(() => localStorage.getItem('identity'))) !== null) throw new Error('successor isolation failed');
        await op('context-successor-close', () => c.close()); cell.closed++; cell.status = 'passed';
      } catch (error) { cell.status = 'failed'; cell.error = String(error.stack || error); result.errors.push(cell.error); }
      finally {
        for (let n = 0; n < owned.length; n++) await cleanup(`${mode}-${index}-owned-context-${n}-cleanup`, () => owned[n].close());
        cell.afterFreeMemory = os.freemem(); cell.ended = new Date().toISOString(); result.cases.push(cell); save();
      }
      console.log(JSON.stringify({ mode, index, status: cell.status, contexts: cell.contexts, closed: cell.closed }));
      if (cell.status !== 'passed' || result.errors.length) throw new Error('stop on first diagnostic or cleanup failure; no retry');
    }
  }
} catch (error) { result.errors.push(String(error.stack || error)); }
finally {
  if (browser) await cleanup('browser-close', () => browser.close());
  await cleanup('server-connections-close', () => server.closeAllConnections());
  await cleanup('server-close', () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  result.ended = new Date().toISOString(); save();
}
console.log(JSON.stringify({ platform: result.platform, arch: result.arch, version: result.version, cases: result.cases.length, passed: result.cases.filter(x => x.status === 'passed').length, errors: result.errors.length }));
if (result.errors.length || result.cases.length !== result.iterationsPerArm * result.modes.length) process.exitCode = 1;
