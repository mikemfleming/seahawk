import { useSyncExternalStore } from 'react';

type RequestRecord = { route: string; status: number; duration: number; requestId: string; serverTiming: string };
let requests: RequestRecord[] = [];
let requestCount = 0;
let notebookMs: number | null = null;
let snapshot: { requests: RequestRecord[]; notebookMs: number | null; requestCount: number } = { requests, notebookMs, requestCount };
const listeners = new Set<() => void>();
function publish() { snapshot = { requests, notebookMs, requestCount }; listeners.forEach(listener => listener()); }
// Memory only, bounded, and deliberately excludes bodies, tokens and URLs.
export function recordRequest(path: string, status: number, started: number, response?: Response) {
  const route = ['/api/config', '/api/family', '/api/archive'].includes(path) ? path : '/api/other';
  requestCount += 1;
  requests = [...requests.slice(-29), { route, status, duration: Math.round(performance.now() - started), requestId: response?.headers.get('X-Request-ID') || '', serverTiming: response?.headers.get('Server-Timing') || '' }];
  publish();
}
export function recordNotebookReady() {
  if (notebookMs !== null) return;
  // Called on the next animation frame after React commits journal content.
  notebookMs = Math.round(performance.now());
  publish();
}
export function useDiagnostics() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => snapshot);
}
