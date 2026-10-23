// Optional passive HTTP evidence; disabled outside the selected diagnostic case.
// Integrate around the existing native server without replacing its I/O/catches.
import { createHash } from 'node:crypto';

export function nativeHttpObservationPort() {
  const observers = new Set();
  const records = [];
  let enabled = false, nextRequestId = 0;
  const record = (event, detail = {}) => {
    if (!enabled) return;
    const row = { event, epoch: Date.now(), ...detail };
    records.push(row);
    const critical = event.startsWith('server-') || event === 'native-http-subscriber-installed'
      || event === 'outage-state' || event === 'request-aborted' || event === 'original-server-catch'
      || event === 'response-closed' && !row.writableFinished
      || ['/service-worker.js', '/', '/index.html'].includes(row.pathname);
    if (critical) {
      try { console.log('[native-http-observation] ' + JSON.stringify(row)); }
      catch (error) { records.push({ event: 'observation-output-error', epoch: Date.now(), message: String(error) }); }
    }
    for (const observer of observers) {
      try { observer(row); }
      catch (error) {
        const failure = { event: 'observer-callback-error', epoch: Date.now(), message: String(error) };
        records.push(failure);
        try { console.log('[native-http-observation] ' + JSON.stringify(failure)); } catch {}
      }
    }
  };
  return {
    subscribeNativeObserver(observer) {
      enabled = true; observers.add(observer); record('native-http-subscriber-installed');
      return () => observers.delete(observer);
    },
    request(req, res) {
      if (!enabled) return { bytesReady() {}, responseScheduled() {}, unavailable() {}, originalCatch() {} };
      const id = ++nextRequestId;
      const pathname = new URL(req.url, 'http://localhost').pathname;
      record('request', { id, pathname, method: req.method,
        destination: req.headers['sec-fetch-dest'], mode: req.headers['sec-fetch-mode'],
        serviceWorker: req.headers['service-worker'], cacheControl: req.headers['cache-control'] });
      req.on('aborted', () => record('request-aborted', { id, pathname }));
      res.on('finish', () => record('response-finished', { id, pathname, status: res.statusCode, writableFinished: res.writableFinished }));
      res.on('close', () => record('response-closed', { id, pathname, status: res.statusCode, writableFinished: res.writableFinished, destroyed: res.destroyed }));
      return {
        bytesReady(body) { record('response-bytes-ready', { id, pathname, bytes: body.length,
          ...(pathname === '/service-worker.js' ? { sha256: createHash('sha256').update(body).digest('hex') } : {}) }); },
        responseScheduled(status) { record('response-scheduled', { id, pathname, status }); },
        unavailable() { record('outage-destroy', { id, pathname }); },
        originalCatch(error) { record('original-server-catch', { id, pathname, code: error?.code, message: String(error?.message ?? error) }); }
      };
    },
    record,
    enabled: () => enabled,
    snapshot: () => [...records]
  };
}
