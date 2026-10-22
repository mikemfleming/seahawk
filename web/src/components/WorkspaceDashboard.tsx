import { CrewRequestSummary } from './CrewRequests';
import { Link } from '../navigation';
import { type Archive, type Entry } from '../types';
export function matchesTask(entry: Entry, task: string) {
  if (task === 'untranscribed') return entry.transcription === '[Awaiting manual transcription]';
  if (task === 'drafts') return entry.status === 'first_pass';
  if (task === 'uncertain') return entry.uncertainties.length > 0 || entry.places.some(place => place.latitude === null);
  if (task === 'private') return entry.visibility === 'private';
  return true;
}
export const taskTitles: Record<string, string> = { all: 'All entries', untranscribed: 'Waiting for transcription', drafts: 'Transcriptions to check', uncertain: 'Unresolved names & places', private: 'Private entries' };
export function WorkspaceDashboard({ archive, onImport }: { archive: Archive; onImport: () => void }) {
  const tasks = [
    { task: 'untranscribed', title: 'Transcribe a page', detail: 'Read the original and put its words into the archive.' },
    { task: 'drafts', title: 'Check a transcription', detail: 'Compare the handwriting, correct readings, and mark it checked.' },
    { task: 'uncertain', title: 'Resolve a question', detail: 'Work through uncertain names, words, and locations.' },
    { task: 'private', title: 'Prepare for family', detail: 'Choose what to share, including entries that need their help.' },
  ];
  const pending = (archive.contributions || []).filter(item => item.status === 'pending').length;
  return <section className="dashboard"><div className="compact-heading"><p className="eyebrow">ARCHIVIST WORKSPACE</p><h1>What would you like to work on?</h1><p>Pick up the next page, or make room for a family memory.</p></div>
    <div className="task-grid"><CrewRequestSummary /><Link className="task-card featured" to="/workspace/review"><span className="eyebrow">FAMILY CONTRIBUTIONS</span><strong>{pending}</strong><h2>Review their additions ↗</h2><p>Memories, photographs, and identifications waiting for you.</p></Link>{tasks.map(task => <Link className="task-card" key={task.task} to={`/workspace/entries?task=${task.task}`}><strong>{archive.entries.filter(entry => matchesTask(entry, task.task)).length}</strong><h2>{task.title} ↗</h2><p>{task.detail}</p></Link>)}<button className="task-card import-task" onClick={onImport}><span>＋</span><h2>Add an original page</h2><p>Preserve another photograph and start its transcription.</p></button></div>
    <p className="subline">{archive.pages.length} original pages · {archive.entries.length} entries · {(archive.contributions || []).filter(item => item.status === 'approved').length} family contributions shared</p>
  </section>;
}
