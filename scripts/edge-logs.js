const sql = 'select timestamp, source_name, event_message from logs where source_name in ('function_logs', 'function_edge_logs') order by timestamp desc limit 15';
const url = `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/analytics/endpoints/logs?sql=${encodeURIComponent(sql)}`;
const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(30000) });
const text = await response.text();
console.log('Function diagnostic response:', response.status, text.replaceAll(process.env.SUPABASE_ACCESS_TOKEN, '[redacted]').replace(/(?:sb_secret_|sk-)[A-Za-z0-9_-]+/g, '[redacted]'));
