import { createServer } from 'node:http';

// Real loopback responses remain observable even when a controlling worker
// forwards fetches outside Playwright page routing. All data is synthetic.
export async function nativeMockHttp() {
  let handler, unavailable = false;
  const pending = new Set();
  const errors = [];
  const server = createServer((request, response) => {
    if (unavailable) { request.socket.destroy(); return; }
    const task = (async () => {
      let body = '';
      for await (const chunk of request) body += chunk;
      const mockRequest = {
        url: () => `http://127.0.0.1:${server.address().port}${request.url}`,
        method: () => request.method,
        headers: () => request.headers,
        postDataJSON: () => JSON.parse(body || 'null')
      };
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS' };
      if (request.method === 'OPTIONS') { response.writeHead(204, cors).end(); return; }
      if (!handler) throw new Error('Synthetic HTTP handler is not installed.');
      await handler({
        request: () => mockRequest,
        abort: async () => { request.socket.destroy(); },
        fulfill: async ({ status = 200, headers = {}, contentType, body = '' }) => {
          response.writeHead(status, { ...cors, ...(contentType ? { 'content-type': contentType } : {}), ...headers });
          response.end(body);
        }
      });
    })().catch(error => {
      // A deliberate outage can abort body transport. Fixture assertions and
      // handler exceptions must still fail the test, even if the app tolerates 500.
      if (!['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE'].includes(error.code)) errors.push(error);
      if (!response.destroyed) response.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ message: error.message }));
    });
    pending.add(task);
    task.finally(() => pending.delete(task));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    setUnavailable: value => { unavailable = value; },
    setHandler: async value => { await Promise.all([...pending]); handler = value; },
    close: async () => {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await Promise.all([...pending]);
      if (errors.length) throw new AggregateError(errors, 'Synthetic HTTP fixture failed.');
    }
  };
}
