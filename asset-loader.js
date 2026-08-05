(() => {
  'use strict';

  const manifest = window.BIG_GAINS_ASSET_MANIFEST;
  if (!manifest) throw new Error('Big Gains asset manifest did not load.');

  const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const markup = [
    ...manifest.styles.map(url => `<link rel="stylesheet" href="${escapeAttribute(url)}" data-big-gains-asset="style">`),
    ...manifest.scripts.map(url => `<script src="${escapeAttribute(url)}" data-big-gains-asset="script"><\/script>`)
  ].join('');

  document.write(markup);
})();
