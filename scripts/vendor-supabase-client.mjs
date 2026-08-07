import { copyFile, mkdir } from 'node:fs/promises';

await mkdir(new URL('../vendor/', import.meta.url), { recursive: true });
await copyFile(
  new URL('../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url),
  new URL('../vendor/supabase.js', import.meta.url)
);
await copyFile(
  new URL('../node_modules/@supabase/supabase-js/LICENSE', import.meta.url),
  new URL('../vendor/SUPABASE-LICENSE', import.meta.url)
);
