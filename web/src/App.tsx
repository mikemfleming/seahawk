import { Diagnostics } from './components/Diagnostics';
import { recordNotebookReady } from './diagnostics';
import { CrewRequests } from './components/CrewRequests';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import { dateLabel, visibilityLabels, type Archive, type Config, type Contribution, type ContributionRequest, type Entry, type ImportResult, type ReviewStatus, type MyContributions } from './types';
import { Navigation, Link, useNavigation, pageHref } from './navigation';
import { Atlas } from './components/Atlas';
import { EntryDetail, PrintEntries } from './components/EntryDetail';
import { EntryEditor } from './components/EntryEditor';
import { ImportDialog } from './components/ImportDialog';
import { Modal } from './components/Modal';
import { FamilyContributions } from './components/FamilyContributions';
import { ContributionForm } from './components/ContributionForm';
import { ReviewQueue } from './components/ReviewQueue';
import { WorkspaceLogin } from './components/WorkspaceLogin';
import { WorkspaceDashboard, matchesTask, taskTitles } from './components/WorkspaceDashboard';
import { Invitations, JoinFamily, YourContributions } from './components/ContributorPages';

export function App() {
  const [accountMode, setAccountMode] = useState<'signin' | 'signup' | 'password' | null>(null);
  const [dirty, setDirty] = useState(false);
  const { route, navigate } = useNavigation(dirty);
  const [archive, setArchive] = useState<Archive | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState('');
  const params = new URLSearchParams(route.path.split('?')[1] || '');
  const query = params.get('q') || '';
  const status = params.get('quality') || '';
  const previewId = !route.workspace && route.page === 'entry' && params.get('preview') === '1' ? route.id : undefined;
  function updateFilter(key: string, value: string) { const url = new URL(route.path, location.origin); if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); navigate(url.pathname + url.search, true, true); }
  const [importing, setImporting] = useState(false);
  const [contributing, setContributing] = useState<{ entry: Entry; request: ContributionRequest } | null>(null);
  const [pendingContribution, setPendingContribution] = useState<{ entry: Entry; request: ContributionRequest } | null>(null);
  const [scan, setScan] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const workspace = route.workspace;
  useEffect(() => {
    const controller = new AbortController();
    setLoadError(''); setArchive(null);
    (async () => {
      const config = await api<Config>('/api/config', undefined, controller.signal);
      if (controller.signal.aborted) return;
      setConfig(config);
      if (workspace && config.role !== 'archivist') return;
      const archive = await api<Archive>(workspace ? '/api/archive' : previewId ? `/api/preview/${previewId}` : '/api/family', undefined, controller.signal);
      if (!controller.signal.aborted) setArchive(archive);
    })().catch(error => { if (!controller.signal.aborted) setLoadError(errorMessage(error)); });
    return () => controller.abort();
  }, [workspace, version, previewId]);
  useEffect(() => {
    if (!archive || workspace) return;
    const frame = requestAnimationFrame(recordNotebookReady);
    return () => cancelAnimationFrame(frame);
  }, [archive, workspace]);
  const lastTrackedPage = useRef('');
  const publicPath = !workspace && !previewId ? route.page === 'home' ? '/' : route.page === 'atlas' ? '/atlas' : route.page === 'entry' && archive?.entries.some(item => item.id === route.id) ? `/entries/${route.id}` : '' : '';
  useEffect(() => {
    if (!archive || !publicPath) { lastTrackedPage.current = ''; return; }
    if (lastTrackedPage.current === publicPath) return;
    lastTrackedPage.current = publicPath;
    // Best effort; no analytics identifiers, retry queue or persistent tracking.
    void api('/api/page-view', { page: publicPath }).catch(() => {});
  }, [archive, publicPath]);
  useEffect(() => { setContributing(null); }, [route.path]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 6500); return () => clearTimeout(timer); }, [message]);
  const contributions = archive?.contributions || [];
  const pending = contributions.filter(item => item.status === 'pending').length;
  const entries = useMemo(() => {
    const search = query.trim().toLowerCase();
    return archive?.entries.filter(entry => (!workspace || ((!status || (status === 'checked' ? entry.status !== 'first_pass' : entry.status === status)) && matchesTask(entry, route.task))) && JSON.stringify([entry.title, entry.transcription, entry.reading_version, entry.people, entry.places, entry.date, entry.date_as_written,
      ...(archive.contributions || []).filter(item => item.entry_id === entry.id && (workspace || item.status === 'approved')).map(item => [item.author, item.text, item.identified_name, item.subject]),
    ]).toLowerCase().includes(search)) || [];
  }, [archive, query, status, workspace, route.task]);
  const entry = archive?.entries.find(entry => entry.id === route.id);
  const taskEntries = entries;
  const nextEntry = entry && taskEntries.find((other, i) => i > taskEntries.findIndex(current => current.id === entry.id) && other.id !== entry.id);
  const suggestion = contributions.find(item => item.id === route.suggestion && item.entry_id === entry?.id && item.kind === 'identification' && item.status === 'approved');
  const refresh = useCallback(async () => setArchive(await api<Archive>('/api/archive')), []);
  function queueQuery() { const params = new URLSearchParams({task: route.task}); if (query) params.set('q', query); if (status) params.set('quality', status); return params.toString(); }
  function editPath(id: string, source?: string) { return `/workspace/entries/${id}/edit?${queueQuery()}${source ? `&suggestion=${source}` : ''}`; }
  async function imported(result: ImportResult) { await refresh(); setImporting(false); navigate(`/workspace/entries/${result.entry_ids[0]}/edit?task=untranscribed`, true); setMessage('Original page preserved. Start checking it beside the scan.'); }
  function saved(result: Entry, next: boolean) {
    setArchive(previous => previous ? { ...previous, entries: previous.entries.map(entry => entry.id === result.id ? result : entry) } : previous);
    setDirty(false); setMessage('Entry saved. Previous version preserved.');
    if (next) navigate(nextEntry ? editPath(nextEntry.id) : `/workspace/entries?${queueQuery()}`, true);
    else if (route.suggestion) navigate(editPath(result.id), true);
  }
  function reviewed(result: Contribution) { setArchive(previous => previous ? { ...previous, contributions: (previous.contributions || []).map(item => item.id === result.id ? result : item) } : previous); setMessage(result.status === 'approved' ? 'Recollection approved. The original log is unchanged.' : result.status === 'declined' ? 'Contribution kept private.' : 'Contribution returned to review.'); }
  async function lock() { if (dirty && !window.confirm('Discard unsaved changes and lock the workspace?')) return; try { await api('/api/logout', {}); setDirty(false); setConfig(previous => previous ? { ...previous, role: 'family', account: null, contributor: null } : previous); navigate('/', true); } catch (error) { setMessage(errorMessage(error)); } }
  async function exportArchive() { try { const latest = await api<Archive>('/api/archive'); const url = URL.createObjectURL(new Blob([`${JSON.stringify(latest, null, 2)}\n`], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ships-log-archive.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (error) { setMessage(errorMessage(error)); } }
  async function printDraft() { await Promise.all([...document.querySelectorAll<HTMLImageElement>('#print-content img')].map(image => image.decode().catch(() => undefined))); window.print(); }
  async function refreshContributor() { const data = await api<MyContributions>('/api/me'); setConfig(previous => previous ? { ...previous, contributor: data.contributor } : previous); }
  const canContribute = config?.role === 'crew' || config?.role === 'archivist';
  function startContribution(entry: Entry, request: ContributionRequest) {
    if (canContribute) { setContributing({ entry, request }); return; }
    if (config?.account) { setMessage('Your account needs Mike’s approval before you can contribute.'); return; }
    setPendingContribution({ entry, request });
    setAccountMode('signin');
  }
  const authorized = !workspace || config?.role === 'archivist';
  const listPage = route.page === 'home' && !workspace || route.page === 'entries';
  const storyPage = route.page === 'entry' || route.page === 'edit';
  const previousIndex = archive?.entries.findIndex(item => item.id === entry?.id) ?? -1;
  const previousStory = previousIndex > 0 ? archive?.entries[previousIndex - 1] : undefined;
  const nextStory = previousIndex >= 0 ? archive?.entries[previousIndex + 1] : undefined;
  return <Navigation.Provider value={navigate}>
    <header className={workspace ? 'workspace-header' : ''}><Link className="brand" to={workspace ? '/workspace' : '/'}><span className="anchor">⚓</span><span>SEAHAWK | 'IO KAI<small>{workspace ? 'ARCHIVIST WORKSPACE' : 'CAPTAIN EDDIE’S LOG'}</small></span></Link><nav aria-label="Main navigation">{workspace ? <><Link to="/workspace" aria-current={route.page === 'home' ? 'page' : undefined}>Tasks</Link><Link to="/workspace/entries" aria-current={listPage || storyPage ? 'page' : undefined}>Entries</Link><Link to="/workspace/review" aria-current={route.page === 'review' ? 'page' : undefined}>Review <span className="nav-count">{pending}</span></Link><Link to="/workspace/members" aria-current={route.page === 'members' ? 'page' : undefined}>Crew requests</Link></> : <><Link to="/" aria-current={listPage || storyPage ? 'page' : undefined}>The journal</Link><Link to="/atlas" aria-current={route.page === 'atlas' ? 'page' : undefined}>The atlas</Link>{canContribute && <Link to="/contributions" aria-current={route.page === 'contributions' ? 'page' : undefined}>Your contributions</Link>}</>}</nav><div className="header-actions">{workspace ? <><a className="quiet" href={pageHref(entry ? `/entries/${entry.id}?preview=1` : '/')} target="_blank" rel="noopener noreferrer">Family preview ↗</a><button className="quiet lock-button" onClick={lock}>Lock workspace</button>{authorized && <button className="primary" onClick={() => setImporting(true)}>＋ Add a page</button>}</> : <>{config?.account ? <><button className="quiet" onClick={() => setAccountMode('password')}>Change password</button><button className="quiet" onClick={async () => { await lock(); setVersion(v => v + 1); }}>Sign out</button></> : <button className="primary sign-in-button" onClick={() => setAccountMode('signin')}>Sign in</button>}{config?.role === 'archivist' && <Link className="workspace-link" to="/workspace">Archivist workspace ↗</Link>}</>}</div></header>
    <main className={route.page === 'edit' ? 'workbench-main' : ''}>
      {config?.role === 'pending' && <p className="help-banner">{config.account?.status === 'declined' ? 'Your crew request was declined. Contact Mike if you have questions.' : 'Your account is awaiting Mike’s approval. You can continue reading public entries.'}</p>}
      {loadError ? <p role="alert" className="error">Could not open the archive: {loadError}</p> : workspace && config && !authorized ? <section className="workspace-gate"><h1>Your archive tools live here.</h1><p>Sign in to check pages, manage family visibility, and review contributions.</p>{config.account ? <p>Your account does not have archivist permissions. <Link to="/">Return to the journal</Link></p> : <WorkspaceLogin onClose={() => navigate('/')} onSignedIn={async () => { setVersion(value => value + 1); }} />}</section> : route.page === 'contributions' ? <YourContributions onScan={setScan} /> : route.page === 'join' ? <JoinFamily token={route.token!} onJoined={async () => { await refreshContributor(); navigate('/contributions'); }} /> : !archive ? <p className="loading" role="status">Opening the notebook…</p> : route.page === 'home' && workspace ? <WorkspaceDashboard archive={archive} onImport={() => setImporting(true)} /> : route.page === 'members' ? <CrewRequests /> : route.page === 'invitations' ? <Invitations archive={archive} onRefresh={refresh} /> : route.page === 'review' ? <ReviewQueue contributions={contributions} entries={archive.entries} pages={archive.pages} onReviewed={reviewed} onRefresh={refresh} onApply={item => navigate(editPath(item.entry_id, item.id))} onScan={setScan} /> : route.page === 'edit' && entry ? <EntryEditor places={archive.entries.flatMap(item => item.places)} key={`${entry.id}-${entry.revisions.length}-${suggestion?.id || ''}`} entry={entry} pages={archive.pages.filter(page => entry.page_ids.includes(page.id))} suggestion={suggestion} nextExists={!!nextEntry} onClose={() => navigate(`/workspace/entries?task=${route.task}`)} onSaved={saved} onDirtyChange={setDirty} onScan={setScan} /> : route.page === 'entry' && entry ? <>
        {previewId && <div className="help-banner preview-banner">Archivist preview · This view does not change family visibility.</div>}<div className="story-navigation"><Link to={workspace ? '/workspace/entries' : '/'}>← {workspace ? 'All entries' : 'Back to the journal'}</Link><div>{previousStory && <Link to={`${workspace ? '/workspace' : ''}/entries/${previousStory.id}`}>← Previous</Link>}{nextStory && <Link to={`${workspace ? '/workspace' : ''}/entries/${nextStory.id}`}>Next →</Link>}</div></div>
        <article className={`story-page${workspace ? '' : ' gallery-entry'}`}><EntryDetail key={`${entry.id}-${workspace}`} entry={entry} pages={archive.pages.filter(page => entry.page_ids.includes(page.id))} archivist={workspace} onEdit={() => navigate(editPath(entry.id))} onScan={setScan} onContribute={workspace ? undefined : request => startContribution(entry, request)} />{workspace ? <div className="workspace-entry-note"><Link className="outlined" to="/workspace/review">Review family contributions ↗</Link></div> : <FamilyContributions entry={entry} contributions={contributions} onContribute={request => startContribution(entry, request)} onScan={setScan} />}</article><div className="story-print"><button className="quiet" onClick={printDraft}>Print this entry and family memories</button></div>
      </> : listPage || route.page === 'atlas' ? <>
        {route.page === 'home' && <section className="intro family-preview-intro"><div><p className="eyebrow">CAPTAIN EDDIE · AHI ED</p><h1>The Seahawk log</h1><p className="lede">Family and crew: open an entry to read the log, share a memory, or help clarify a detail.</p><button className="outlined" onClick={() => document.getElementById('journal')?.scrollIntoView({ behavior: 'smooth' })}>Browse entries ↓</button></div><span className="archive-count">{archive.pages.length} {archive.pages.length === 1 ? 'page' : 'pages'} · {archive.entries.length} {archive.entries.length === 1 ? 'entry' : 'entries'}</span></section>}
        {workspace && <div className="compact-heading"><p className="eyebrow">WORK QUEUE</p><h1>{taskTitles[route.task] || 'All entries'}</h1><p>Open a page beside its transcription, then save and continue through this queue.</p><div className="task-filter-links">{Object.entries(taskTitles).map(([task,title]) => <Link key={task} to={`/workspace/entries?task=${task}`} aria-current={route.task === task ? 'page' : undefined}>{title}</Link>)}</div></div>}
        <div className="toolbar" id="journal"><div><span className="eyebrow">{route.page === 'atlas' ? 'THE ATLAS' : workspace ? 'YOUR ENTRIES' : 'THE JOURNAL'}</span><span id="result-count">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></div><div className="tools"><label className="sr-only" htmlFor="search">Search the archive</label><input id="search" type="search" placeholder="Search entries, people, places…" value={query} onChange={event => updateFilter('q', event.target.value)} />{workspace && <><label className="sr-only" htmlFor="status-filter">Transcription quality</label><select id="status-filter" value={status} onChange={event => updateFilter('quality', event.target.value)}><option value="">All transcriptions</option><option value="first_pass">Draft</option><option value="checked">Checked</option></select><button onClick={exportArchive}>↓ Export archive</button></>}<button disabled={!entries.length} onClick={printDraft}>{workspace ? 'Print queue draft' : 'Print family draft'}</button></div></div>
        {route.page === 'atlas' ? <Atlas entries={entries} /> : <div className="journal-grid">{entries.map(item => <Link className="journal-card" key={item.id} to={workspace ? editPath(item.id) : `/entries/${item.id}`}><p className="eyebrow">{dateLabel(item)}</p><h2>{item.title}</h2><p className="entry-excerpt">{(item.reading_version || item.transcription).slice(0, 210)}{(item.reading_version || item.transcription).length > 210 ? '…' : ''}</p><p className="subline">{item.people.join(' · ')}</p><div className="card-bottom"><span>{workspace ? `${item.status === 'first_pass' ? 'Draft' : 'Checked'} · ${visibilityLabels[item.visibility || 'help']}` : item.visibility === 'help' ? 'Shared for help' : `${contributions.filter(c => c.entry_id === item.id && c.status === 'approved').length} family contributions`}</span><span>{workspace ? 'Open workbench →' : 'Read entry →'}</span></div></Link>)}{!entries.length && <div className="empty"><h2>{workspace ? 'This queue is clear.' : 'No entries found.'}</h2><p>{workspace ? 'Choose another task or add a new original page.' : 'Try another name, place, or phrase.'}</p></div>}</div>}
      </> : <div className="empty"><h1>This entry isn’t available here.</h1><p>It may be private while Mike prepares it, or this link may no longer be valid.</p><Link className="outlined" to={workspace ? '/workspace' : '/'}>Return to {workspace ? 'the workspace' : 'the journal'}</Link></div>}
      {config?.role === 'archivist' && <Diagnostics />}
      <footer><span>Seahawk · ‘io kai · Captain Eddie / Ahi Ed</span><span>{workspace ? <button className="quiet" onClick={lock}>Lock workspace</button> : 'Log archive · Family and crew'}</span></footer>
    </main>
    {accountMode && <WorkspaceLogin initialMode={accountMode} contributionKind={pendingContribution?.request.kind} onClose={() => { setAccountMode(null); setPendingContribution(null); }} onSignedIn={async () => {
      const nextConfig = await api<Config>('/api/config');
      setConfig(nextConfig);
      setVersion(v => v + 1);
      if (pendingContribution && (nextConfig.role === 'crew' || nextConfig.role === 'archivist')) {
        setContributing(pendingContribution);
        setPendingContribution(null);
      }
    }} />}
    {archive && <PrintEntries entries={entry ? [entry] : entries} pages={archive.pages} contributions={contributions} />}
    {importing && config && workspace && authorized && <ImportDialog config={config} onClose={() => setImporting(false)} onImported={imported} />}
    {contributing && <ContributionForm entry={contributing.entry} request={contributing.request} contributor={config?.contributor} onClose={() => setContributing(null)} onSubmitted={refreshContributor} onViewMine={() => { setContributing(null); navigate('/contributions'); }} />}
    {scan && <Modal id="scan-dialog" titleId="scan-title" onClose={() => setScan('')}><h2 id="scan-title" className="sr-only">Archive photograph</h2><button className="close" aria-label="Close photo" onClick={() => setScan('')}>×</button><img id="full-scan" src={scan} alt="Enlarged archive photograph" /></Modal>}
    {message && <div id="toast" role="status">{message}</div>}
  </Navigation.Provider>;
}
