import { writeFile } from 'node:fs/promises';

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabasePublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
}

const source = `(() => {\n  'use strict';\n  window.__BIG_GAINS_CLOUD_CONFIG__ = Object.freeze({\n    supabaseUrl: ${JSON.stringify(supabaseUrl)},\n    supabasePublishableKey: ${JSON.stringify(supabasePublishableKey)},\n    authRedirectUrl: 'https://velazquick.github.io/big-gains/'\n  });\n})();\n`;

await writeFile(new URL('../cloud-config.js', import.meta.url), source, { mode: 0o600 });
