export interface Route { path: string; workspace: boolean; page: 'home' | 'entries' | 'entry' | 'edit' | 'atlas' | 'review' | 'invitations' | 'contributions' | 'join' | 'members' | 'missing'; id?: string; token?: string; task: string; suggestion?: string }
export function parseRoute(href: string): Route {
  const url = new URL(href, 'http://localhost');
  const path = url.pathname.replace(/\/$/, '') || '/';
  const workspace = path === '/workspace' || path.startsWith('/workspace/');
  const base = { path: path + url.search, workspace, task: url.searchParams.get('task') || 'all', suggestion: url.searchParams.get('suggestion') || undefined };
  if (path === '/') return { ...base, page: 'home' };
  if (path === '/workspace') return { ...base, page: 'home' };
  if (path === '/workspace/entries') return { ...base, page: 'entries' };
  if (path === '/atlas' || path === '/workspace/atlas') return { ...base, page: 'atlas' };
  if (path === '/workspace/members') return { ...base, page: 'members' };
  if (path === '/workspace/review') return { ...base, page: 'review' };
  if (path === '/workspace/invitations') return { ...base, page: 'invitations' };
  if (path === '/contributions') return { ...base, page: 'contributions' };
  const entry = /^\/(?:workspace\/)?entries\/([A-Za-z0-9_-]+)(\/edit)?$/.exec(path);
  if (entry && (!entry[2] || workspace)) return { ...base, page: entry[2] ? 'edit' : 'entry', id: entry[1] };
  const join = /^\/join\/([A-Za-z0-9_-]+)$/.exec(path);
  if (join) return { ...base, page: 'join', token: join[1] };
  return { ...base, page: 'missing' };
}
