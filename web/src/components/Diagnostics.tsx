import { useDiagnostics } from '../diagnostics';
export function Diagnostics() {
  const { requests, notebookMs, requestCount } = useDiagnostics();
  return <details className="diagnostics"><summary>Load diagnostics</summary>
    <p>Notebook visible: {notebookMs === null ? 'Waiting for entries' : `${notebookMs} ms from page navigation`}. API requests this visit: {requestCount}{requests.length === 30 ? ' (latest 30 retained)' : ''}. Cache: disabled.</p>
    <p>Timings include network travel; backend timings separate authentication, database, commit, and photo links. Status 0 means the request failed or was cancelled. Request IDs match Supabase function logs.</p>
    <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Route</th><th>Status</th><th>Time</th><th>Backend timing</th><th>Request ID</th></tr></thead><tbody>{requests.map((item, index) => <tr key={index}><td>{item.route}</td><td>{item.status}</td><td>{item.duration} ms</td><td>{item.serverTiming || 'Unavailable'}</td><td><code>{item.requestId || 'Unavailable'}</code></td></tr>)}</tbody></table></div>
  </details>;
}
