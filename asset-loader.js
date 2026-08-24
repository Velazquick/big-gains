(() => {
  'use strict';

  const manifest = window.BIG_GAINS_ASSET_MANIFEST;
  if (!manifest) throw new Error('Big Gains asset manifest did not load.');

  const required = new Set((manifest.requiredScripts || manifest.scripts).map(url => new URL(url, location.href).href));
  const optional = new Set((manifest.optionalScripts || []).map(url => new URL(url, location.href).href));
  const failures = [];
  let monitoring = true;

  const stableName = url => {
    try { return new URL(url, location.href).pathname.split('/').pop() || 'asset'; }
    catch { return 'asset'; }
  };

  function record(url, code) {
    if (!monitoring || !url) return false;
    let absolute;
    try { absolute = new URL(url, location.href).href; } catch { return false; }
    const isRequired = required.has(absolute);
    const isOptional = optional.has(absolute);
    if (!isRequired && !isOptional) return false;
    const failure = Object.freeze({
      code,
      component: stableName(absolute),
      required: isRequired
    });
    if (!failures.some(item => item.code === failure.code && item.component === failure.component)) failures.push(failure);
    if (isRequired) {
      if (window.BigGainsRuntimeGate?.fail) window.BigGainsRuntimeGate.fail(code, failure.component);
      else {
        document.documentElement.dataset.runtimeState = 'recovery';
        const detail = document.getElementById('bootShellDetail');
        const retry = document.getElementById('bootRetry');
        if (detail) detail.textContent = 'Big Gains could not finish starting. Reload to try again. Your training data was not changed.';
        if (retry) retry.hidden = false;
      }
    }
    return true;
  }

  window.addEventListener('error', event => {
    const targetUrl = event.target?.dataset?.bigGainsAsset === 'script' ? event.target.src : null;
    if (targetUrl) record(targetUrl, 'required-asset-load-failed');
    else if (event.filename) record(event.filename, 'startup-script-execution-failed');
  }, true);

  window.BigGainsAssetStatus = Object.freeze({
    complete: () => { monitoring = false; return true; },
    status: () => Object.freeze({
      monitoring,
      failures: Object.freeze(failures.map(item => Object.freeze({ ...item }))),
      requiredFailures: Object.freeze(failures.filter(item => item.required).map(item => Object.freeze({ ...item })))
    })
  });
  document.getElementById('bootRetry')?.addEventListener('click', () => location.reload());

  const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const markup = [
    ...manifest.styles.map(url => `<link rel="stylesheet" href="${escapeAttribute(url)}" data-big-gains-asset="style">`),
    ...manifest.scripts.map(url => `<script src="${escapeAttribute(url)}" data-big-gains-asset="script"><\/script>`)
  ].join('');

  document.write(markup);
})();
