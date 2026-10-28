import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const directory = resolve(process.argv[2] || 'tests');
// This contract runs in the protected workflow's disposable PostgreSQL step.
// Every other Node contract runs here, with its actual process exit status.
const databaseContracts = new Set(['operator-db.test.mjs']);
const files = (await readdir(directory)).filter(name => name.endsWith('.test.mjs') && !databaseContracts.has(name)).sort();
if (!files.length) throw new Error('No Node unit contracts found.');
console.log(`Running ${files.length} Node contract files; database contract runs separately.`);
const child = spawn(process.execPath, ['--test', ...files.map(name => resolve(directory, name))], { stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
