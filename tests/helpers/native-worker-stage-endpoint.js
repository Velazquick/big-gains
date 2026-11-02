// Reserved metadata endpoint in the selected disposable diagnostic origin.
// Integrate only after the original down/socket-destroy branch and before file read.
// The caller passes the URL already parsed by the existing native handler.
export const WORKER_STAGE_PATH = '/__bg_test_worker_stage__';
const STAGES = new Set([
  'bootstrap', 'imports-returned', 'install-dispatch',
  'observer-cache-hook-ready', 'observer-cache-hook-failed',
  'observer-waituntil-hook-ready', 'observer-waituntil-hook-failed',
  'observer-install-listener-ready', 'observer-install-listener-failed',
  'observer-install-hook-failed', 'observer-promise-hook-failed',
  'cache-open-start', 'cache-open-returned', 'cache-open-fulfilled', 'cache-open-rejected', 'cache-open-threw',
  'install-waituntil-returned', 'install-promise-fulfilled', 'install-promise-rejected'
]);

export function handleSelectedWorkerStage({ selected, url, req, res, nativeObservation, observation }) {
  if (!selected || url.pathname !== WORKER_STAGE_PATH) return false;
  const stage = url.searchParams.get('stage');
  const seq = url.searchParams.get('seq'), op = url.searchParams.get('op');
  const instance = url.searchParams.get('instance');
  const valid = req.method === 'GET' && STAGES.has(stage)
    && /^[1-9][0-9]*$/.test(seq || '') && /^(0|[1-9][0-9]*)$/.test(op || '')
    && /^[a-zA-Z0-9-]{10,100}$/.test(instance || '')
    && [...url.searchParams.keys()].every(key => ['stage', 'seq', 'op', 'instance'].includes(key));
  if (!valid) { observation.responseScheduled(400); res.writeHead(400).end(); return true; }
  // No raw query, auth headers, body, cache name, error text or user facts recorded.
  nativeObservation.record('worker-stage', { instance, stage, seq: Number(seq), operation: Number(op) });
  observation.bytesReady(Buffer.alloc(0));
  observation.responseScheduled(204);
  res.writeHead(204, { 'Cache-Control': 'no-store' }).end();
  return true;
}
