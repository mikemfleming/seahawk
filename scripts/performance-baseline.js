// Read-only, anonymous measurements. No response contents or signed URLs printed.
const base = process.env.VITE_EDGE_API_URL || 'https://ojghunkaaywzvdlqviqc.supabase.co/functions/v1/ships-log';
for (let visit = 1; visit <= 3; visit++) {
  const started = performance.now();
  const requests = [];
  // Mirrors the current sequential startup; change alongside the app when optimizing.
  for (const route of ['/api/config', '/api/family']) {
    const begin = performance.now();
    const response = await fetch(base + route, { headers: { Origin: 'https://mikemfleming.github.io' }, signal: AbortSignal.timeout(30000) });
    await response.arrayBuffer();
    requests.push({ route, status: response.status, duration_ms: Math.round(performance.now() - begin), request_id: response.headers.get('x-request-id'), server_timing: response.headers.get('server-timing') });
    if (!response.ok) throw new Error(`Baseline failed: ${route} ${response.status}`);
  }
  console.log(JSON.stringify({ visit, api_load_ms: Math.round(performance.now() - started), requests }));
}
