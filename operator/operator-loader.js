(async()=>{
  try {
    // Use a fresh manifest/config in this standalone surface. No training boot.
    const script=src=>new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.head.append(el);});
    await script(`../asset-manifest.js?operator=${Date.now()}`);
    await script(`../cloud-config.js?v=${encodeURIComponent(window.BIG_GAINS_ASSET_MANIFEST.cloudConfigVersion)}`);
    await script('../vendor/supabase.js');
    await script('./operator.js');
  } catch {document.getElementById('gate').textContent='Operator is unavailable. Return to Big Gains and try again later.';}
})();
