import { writeFile } from 'node:fs/promises';

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabasePublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const automaticReconciliation = /^(1|true)$/i.test(String(process.env.BIG_GAINS_AUTOMATIC_RECONCILIATION || '').trim());

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
}

const source = `(() => {\n  'use strict';\n  window.__BIG_GAINS_CLOUD_CONFIG__ = Object.freeze({\n    supabaseUrl: ${JSON.stringify(supabaseUrl)},\n    supabasePublishableKey: ${JSON.stringify(supabasePublishableKey)},\n    automaticReconciliation: ${JSON.stringify(automaticReconciliation)},\n    authRedirectUrl: 'https://velazquick.github.io/big-gains/',\n    authSetupRedirectUrl: 'https://velazquick.github.io/big-gains/auth-setup.html'\n  });\n})();\n`;

await writeFile(new URL('../cloud-config.js', import.meta.url), source, { mode: 0o600 });
