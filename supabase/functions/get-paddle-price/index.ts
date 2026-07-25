import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { priceId, environment } = await req.json();
    if (!priceId) throw new Error('priceId required');
    const env = (environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;
    const res = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(priceId)}`);
    const data = await res.json();
    if (!data.data?.length) throw new Error(`Price ${priceId} not found`);
    return new Response(JSON.stringify({ paddleId: data.data[0].id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('get-paddle-price error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});