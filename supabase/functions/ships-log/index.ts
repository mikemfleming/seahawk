import process from 'node:process';
process.env.SHIPS_LOG_EDGE = '1';
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY;
let handler;
Deno.serve(async request => {
  try {
    if (!handler) { const { createEdgeHandler } = await import('../../../lib/edge-handler.js'); handler = createEdgeHandler(); }
    return await handler(request);
  } catch (error) {
    console.error('API initialization error', error);
    return Response.json({ error: String(error) }, { status: 503 });
  }
});
