((scope) => {
  'use strict';

  const release = 'v102-rc-active-workout-units';
  const cloudConfigVersion = 'config-925e766c1b907250'; // BIG_GAINS_CLOUD_CONFIG_VERSION
  const deploymentVersion = `${release}-${cloudConfigVersion}`;
  const manifestAsset = `./asset-manifest.js?v=${encodeURIComponent(deploymentVersion)}`;
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
    './jorge-train-v52.css',
    './progress-dashboard-v56.css',
    './history-explorer-v75.css',
    './routine-prescription-v58.css',
    './goals.css',
    './program-setup.css',
    './exercise-picker.css',
  './user-data-export.css',
  './settings.css'
  ];
  const scripts = [
    './boot-render-gate.js',
    './runtime-interactivity-gate.js',
    './account-context.js',
    './cloud-config.js',
    './vendor/supabase.js',
    './supabase-client.js',
    './reconciliation-control.js',
    './cloud-storage.js',
    './program-model.js',
    './program-origin.js',
    './program-domain-envelope.js',
    './program-domain-sync.js',
    './program-domain-recovery.js',
    './program-domain-cutover.js',
    './measurement-units.js',
    './state-persistence.js',
    './user-data-export.js',
    './profiles.js',
    './exercise-catalog.js',
    './program-analyzer.js',
    './programming-engine.js',
    './programming-application.js',
    './programming-review.js',
    './exercise-picker.js',
    './routine-engine.js',
    './analytics.js',
    './goals-progression.js',
    './goals.js',
    './goals-train-guidance.js',
    './workout-session-controller.js',
    './workout-controls.js',
    './notes.js',
    './timer-controller.js',
    './progress.js',
    './retrospective-workout.js',
    './cloud-shadow.js',
    './managed-profile-recovery.js',
    './app.js',
    './program-portability.js',
    './program-setup.js',
    './workout-mode.js',
    './v2-shell.js',
    './alexa-shell.js',
    './training-pet.js',
    './design-v21.js',
    './session-selector-v26.js',
    './sync-gateway.js',
    './account-onboarding.js',
    './migration-preview.js',
    './cloud-sync.js',
    './migration-engine.js',
    './controlled-migration.js',
    './shell-init.js'
  ];
  const optionalScriptPaths = new Set([
    './reconciliation-control.js',
    './cloud-storage.js',
    './program-domain-envelope.js',
    './program-domain-sync.js',
    './program-domain-recovery.js',
    './program-domain-cutover.js',
    './program-portability.js',
    './cloud-shadow.js',
    './alexa-shell.js',
    './training-pet.js',
    './design-v21.js',
    './sync-gateway.js',
    './migration-preview.js',
    './cloud-sync.js',
    './migration-engine.js',
    './controlled-migration.js'
  ]);
  const revision = path => `${path}?v=${encodeURIComponent(
    path === './cloud-config.js' ? cloudConfigVersion : release
  )}`;
  const revisionedStyles = styles.map(revision);
  const revisionedScripts = scripts.map(revision);
  const requiredScripts = scripts.filter(path => !optionalScriptPaths.has(path)).map(revision);
  const optionalScripts = scripts.filter(path => optionalScriptPaths.has(path)).map(revision);
  const authSetupStyles = ['./auth-setup.css'].map(revision);
  const authSetupScripts = ['./cloud-config.js', './vendor/supabase.js', './auth-setup.js'].map(revision);
  const coreAssets = [
    './index.html',
    './auth-setup.html',
    manifestAsset,
    './asset-loader.js',
    './auth-setup-loader.js',
    './service-worker-core.js',
    ...revisionedStyles,
    ...revisionedScripts,
    ...authSetupStyles,
    ...authSetupScripts.filter(path => !revisionedScripts.includes(path)),
    './manifest.webmanifest',
    './icon.svg',
    './assets/timer-ready.wav'
  ];

  if (new Set(coreAssets).size !== coreAssets.length) {
    throw new Error('Big Gains asset manifest contains duplicate core assets.');
  }

  const manifest = Object.freeze({
    release,
    cloudConfigVersion,
    deploymentVersion,
    manifestAsset,
    cachePrefix,
    cacheName: `${cachePrefix}${release}-${cloudConfigVersion}`,
    runtimeCachePrefix,
    runtimeCacheName: `${runtimeCachePrefix}${release}-${cloudConfigVersion}`,
    legacyCacheNames: Object.freeze([...legacyCacheNames]),
    styles: Object.freeze(revisionedStyles),
    scripts: Object.freeze(revisionedScripts),
    requiredScripts: Object.freeze(requiredScripts),
    optionalScripts: Object.freeze(optionalScripts),
    authSetupStyles: Object.freeze(authSetupStyles),
    authSetupScripts: Object.freeze(authSetupScripts),
    coreAssets: Object.freeze(coreAssets)
  });

  Object.defineProperty(scope, 'BIG_GAINS_ASSET_MANIFEST', {
    configurable: false,
    enumerable: true,
    value: manifest,
    writable: false
  });
})(typeof self === 'object' ? self : globalThis);
