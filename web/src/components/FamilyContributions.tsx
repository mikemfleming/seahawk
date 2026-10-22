import { type Contribution, type ContributionRequest, type Entry } from '../types';

export const contributionLabels = { memory: 'Memory', clarification: 'Clarification', identification: 'Suggested identification', photo: 'Photo' };
export function ContributionContent({ item, onScan }: { item: Contribution; onScan: (url: string) => void }) {
  return <>
    {item.context && <p className="contribution-context">{item.context}</p>}
    {item.kind === 'identification' && <p className="identification"><span>{item.subject}</span><strong>{item.identified_name}</strong></p>}
    {item.photo && <figure className="contribution-photo"><button className="source-button" onClick={() => onScan(item.photo!.url)} aria-label={`Enlarge photo shared by ${item.author}`}><img src={item.photo.url} alt={item.text || 'Family photograph'} loading="lazy" /></button><figcaption>Photo credit: {item.photo.credit}</figcaption></figure>}
    {item.text && <p className="contribution-text">{item.text}</p>}
  </>;
}
export function FamilyContributions({ entry, contributions, onContribute, onScan }: {
  entry: Entry; contributions: Contribution[]; onContribute?: (request: ContributionRequest) => void; onScan: (url: string) => void;
}) {
  const approved = contributions.filter(item => item.entry_id === entry.id && item.status === 'approved');
  return <section className="family-contributions" aria-labelledby="family-stories-title">
    <div className="section-heading"><h2 id="family-stories-title">Crew contributions</h2>{onContribute && <button className="outlined" onClick={() => onContribute({ kind: 'memory' })}>Share a memory</button>}</div>
    <p className="hint">Memories can include a photo and appear after archivist approval. {onContribute && <button className="text-action" onClick={() => onContribute({ kind: 'identification' })}>Identify someone</button>}</p>
    <div className="family-story-list">{approved.map(item => <article className="contribution-card" key={item.id}><p className="eyebrow">{contributionLabels[item.kind]}</p><ContributionContent item={item} onScan={onScan} />{item.photo && onContribute && <button className="outlined" onClick={() => onContribute({kind: 'identification', subject: `People in the photo shared by ${item.author}`, prompt: 'Who is pictured in this photograph?', target_contribution_id: item.id})}>Who’s pictured here? ↗</button>}<div className="contribution-byline"><strong>Shared by {item.author}</strong><span>{new Date(item.created_at).toLocaleDateString()}</span></div>{item.kind === 'identification' && <p className="hint">Suggested identification; the original log is unchanged.</p>}</article>)}</div>
    {!approved.length && <div className="contribution-empty">No approved contributions yet.</div>}
  </section>;
}
