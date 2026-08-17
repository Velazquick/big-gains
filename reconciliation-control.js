(() => {
  'use strict';

  const FUNCTION_NAME = 'reconciliation-control';
  const CONTROL_REVISION = 1;
  const DEFAULT_TIMEOUT_MS = 4_000;

  function frozenDecision(enabled, reason, detail, revision = null) {
    return Object.freeze({
      enabled: enabled === true,
      reason,
      detail,
      revision,
      checkedAt: new Date().toISOString()
    });
  }

  function unavailable(detail) {
    return frozenDecision(false, 'runtime-unavailable', detail);
  }

  function errorDetail(error, response) {
    const status = response?.status || error?.context?.status;
    if (status === 401 || status === 403) return `http-${status}`;
    if (error?.context?.status) return `http-${error.context.status}`;
    if (error?.name === 'AbortError' || error?.context?.name === 'AbortError') return 'timeout';
    return 'request-failed';
  }

  function create({ supabaseBoundary = window.BigGainsSupabase, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    let lastDecision = unavailable('not-checked');

    async function check() {
      let session;
      try {
        session = await supabaseBoundary?.session?.();
      } catch {
        return (lastDecision = unavailable('session-unavailable'));
      }
      if (!session?.user?.id || !session?.access_token) {
        return (lastDecision = unavailable('signed-out'));
      }

      const client = supabaseBoundary?.getClient?.();
      if (typeof client?.functions?.invoke !== 'function') {
        return (lastDecision = unavailable('client-unavailable'));
      }

      const controller = new AbortController();
      let timer = null;
      const timeout = new Promise(resolve => {
        timer = window.setTimeout(() => {
          controller.abort();
          resolve({ timedOut: true });
        }, timeoutMs);
      });

      try {
        const invocation = client.functions.invoke(FUNCTION_NAME, {
          body: {},
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            Pragma: 'no-cache'
          },
          signal: controller.signal
        });
        const result = await Promise.race([invocation, timeout]);
        if (result?.timedOut) return (lastDecision = unavailable('timeout'));
        if (result?.error) {
          return (lastDecision = unavailable(errorDetail(result.error, result.response)));
        }
        const payload = result?.data;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          return (lastDecision = unavailable('invalid-json'));
        }
        if (payload.revision !== CONTROL_REVISION) {
          return (lastDecision = unavailable('invalid-revision'));
        }
        if (typeof payload.automaticReconciliation !== 'boolean') {
          return (lastDecision = unavailable('invalid-value'));
        }
        lastDecision = payload.automaticReconciliation
          ? frozenDecision(true, 'runtime-on', 'remote-enabled', CONTROL_REVISION)
          : frozenDecision(false, 'runtime-off', 'remote-disabled', CONTROL_REVISION);
        return lastDecision;
      } catch (error) {
        return (lastDecision = unavailable(errorDetail(error)));
      } finally {
        if (timer !== null) window.clearTimeout(timer);
      }
    }

    return Object.freeze({
      check,
      status: () => lastDecision
    });
  }

  Object.defineProperty(window, 'BigGainsReconciliationControl', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ CONTROL_REVISION, DEFAULT_TIMEOUT_MS, FUNCTION_NAME, create }),
    writable: false
  });
})();
