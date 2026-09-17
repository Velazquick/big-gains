import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
await import('../asset-manifest.js');
const manifest = globalThis.BIG_GAINS_ASSET_MANIFEST;
const paths = ['asset-manifest.js', 'goals-progression.js', 'goals-train-guidance.js', 'goals.js', 'app.js'];
const hash = value => createHash('sha256').update(value).digest('hex');
const expected = new Map(await Promise.all(paths.map(async path => [path, hash(await readFile(new URL('../' + path, import.meta.url)))])));
for (let attempt = 0; attempt < 24; attempt++) {
  const mismatches = [];
  for (const path of paths) {
    try {
      const url = new URL(path, 'https://app.getbiggains.com/');
      url.searchParams.set('verify', process.env.GITHUB_SHA || manifest.deploymentVersion);
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      const actual = hash(Buffer.from(await response.arrayBuffer()));
      if (!response.ok || actual !== expected.get(path)) mismatches.push(path);
    } catch { mismatches.push(path); }
  }
  if (!mismatches.length) {
    console.log('Production bytes verified:', manifest.release, manifest.cloudConfigVersion, process.env.GITHUB_SHA);
    for (const [path, digest] of expected) console.log(path, digest);
    process.exit(0);
  }
  console.log('Waiting for deployed assets:', mismatches.join(', '));
  await setTimeout(5000);
}
throw new Error('Production assets did not match the tested deployment.');
