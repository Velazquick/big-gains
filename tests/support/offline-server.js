// A real unavailable origin, without accepting and resetting every new request
// or using WebKit's protocol offline override (which can bypass worker fallback).
export function offlineServer(server) {
  const port = server.address().port;
  return async offline => {
    if (offline && server.listening) {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        // Also close browser preconnect/keep-alive sockets, so the origin really
        // is unavailable and close() cannot hang on an unused preconnection.
        server.closeAllConnections();
      });
    } else if (!offline && !server.listening) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
    }
  };
}
