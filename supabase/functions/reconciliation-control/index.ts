const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Vary': 'Authorization'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(request => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders, ...noStoreHeaders } });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method-not-allowed' }), {
      status: 405,
      headers: { ...corsHeaders, ...noStoreHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    automaticReconciliation: Deno.env.get('BIG_GAINS_AUTOMATIC_RECONCILIATION') === 'true',
    revision: 1
  }), {
    status: 200,
    headers: { ...corsHeaders, ...noStoreHeaders, 'Content-Type': 'application/json' }
  });
});
