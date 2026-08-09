((scope) => {
  'use strict';

  const release = 'v55-phase4i-analytics-library';
  const cachePrefix = 'big-gains-shell-';
  const runtimeCachePrefix = 'big-gains-runtime-';
  const legacyCacheNames = ['big-gains-v33-state-persistence-api'];
  const styles = [
    './styles.css',
    './v2-shell.css',
    './workout-mode.css',
    './profiles.css',
    './training-pet.css',
    './workout-controls.css',
    './design-v21.css',
    './moss-cards-v24.css',
    './alexa-contrast-v22.css',
    './session-selector-v26.css',
    './sync-gateway.css',
    './training-calendar.css',
    './retrospective-workout.css',
    './cloud-sync.css',
    './migration-preview.css',
    './controlled-migration.css',
    './jorge-train-v52.css'
  ];
  const scripts = [
    './account-context.js',
    './cloud-config.js',
    './vendor/supabase.js',
    './supabase-client.js',
    './cloud-storage.js',
    './state-persistence.js',
    './profiles.js',
    './analytics.js',
    './workout-controls.js',
    './notes.js',
    './progress.js',
    './retrospective-workout.js',
    './app.js',
    './workout-mode.js',
    './v2-shell.js',
    './alexa-shell.js',
    './training-pet.js',
    './design-v21.js',
    './session-selector-v26.js',
    './sync-gateway.js',
    './account-onboarding.js',
    './migration-preview.js',
    './cloud-shadow.js',
    './managed-profile-recovery.js',
    './cloud-sync.js',
    './migration-engine.js',
    './controlled-migration.js',
    './shell-init.js'
  ];
  const revision = path => `${path}?v=${encodeURIComponent(release)}`;
  const revisionedStyles = styles.map(revision);
  const revisionedScripts = scripts.map(revision);
  const coreAssets = [
    './index.html',
    './asset-manifest.js',
    './asset-loader.js',
    './service-worker-core.js',
    ...revisionedStyles,
    ...revisionedScripts,
    './manifest.webmanifest',
    './icon.svg',
    './assets/timer-ready.wav'
  ];

  if (new Set(coreAssets).size !== coreAssets.length) {
    throw new Error('Big Gains asset manifest contains duplicate core assets.');
  }

  const manifest = Object.freeze({
    release,
    cachePrefix,
    cacheName: `${cachePrefix}${release}`,
    runtimeCachePrefix,
    runtimeCacheName: `${runtimeCachePrefix}${release}`,
    legacyCacheNames: Object.freeze([...legacyCacheNames]),
    styles: Object.freeze(revisionedStyles),
    scripts: Object.freeze(revisionedScripts),
    coreAssets: Object.freeze(coreAssets)
  });

  Object.defineProperty(scope, 'BIG_GAINS_ASSET_MANIFEST', {
    configurable: false,
    enumerable: true,
    value: manifest,
    writable: false
  });
})(typeof self === 'object' ? self : globalThis);
