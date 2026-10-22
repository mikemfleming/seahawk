let handler: ((request: Request) => Promise<Response>) | undefined;
Deno.serve(async request => {
  try {
    if (!handler) {
      const env = {
        ...Deno.env.toObject(),
        SUPABASE_SECRET_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        SUPABASE_PUBLISHABLE_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
      };
      const { createEdgeHandler } = await import('../../../lib/edge-handler.js');
      handler = createEdgeHandler({ env });
    }
    return await handler(request);
  } catch (error) {
    console.error('API initialization error', error);
    return Response.json({ error: 'The API is temporarily unavailable.' }, { status: 503 });
  }
});
