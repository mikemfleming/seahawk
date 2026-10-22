import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { PlaceEditor } from './PlaceEditor';
import { api, errorMessage } from '../api';
import { type DateCertainty, type EditableEntry, type Entry, type Place, type ReviewStatus, type Weather, type WeatherKind, type Page, type Contribution, type FamilyVisibility } from '../types';


function Input({ label, value, onValue, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string; onValue: (value: string) => void;
}) {
  return <label className="field">{label}<input {...props} value={value} onChange={event => onValue(event.target.value)} /></label>;
}
function TextArea({ label, value, onValue, rows = 3 }: { label: string; value: string; onValue: (value: string) => void; rows?: number }) {
  return <label className="field">{label}<textarea value={value} rows={rows} onChange={event => onValue(event.target.value)} required={label === 'Faithful transcription'} /></label>;
}
const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);

function initialDraft(entry: Entry, suggestion?: Contribution): EditableEntry {
  const draft = { ...structuredClone(entry), visibility: entry.visibility || 'help' as FamilyVisibility };
  if (suggestion) {
    draft.people = draft.people.includes(suggestion.subject)
      ? draft.people.map(person => person === suggestion.subject ? suggestion.identified_name : person)
      : [...new Set([...draft.people, suggestion.identified_name])];
    draft.editorial_notes = [draft.editorial_notes, 'Identification suggested by ' + suggestion.author + ': ' + suggestion.subject + ' → ' + suggestion.identified_name + ' (' + suggestion.id + ').'].filter(Boolean).join('\n');
  }
  return draft;
}
export function EntryEditor({ entry, pages, places, suggestion, nextExists, onClose, onSaved, onDirtyChange, onScan }: {
  entry: Entry; pages: Page[]; places: Place[]; suggestion?: Contribution; nextExists: boolean; onClose: () => void;
  onSaved: (entry: Entry, next: boolean) => void; onDirtyChange: (dirty: boolean) => void; onScan: (url: string) => void;
}) {
  const [draft, setDraft] = useState<EditableEntry>(() => initialDraft(entry, suggestion));
  const [people, setPeople] = useState(() => initialDraft(entry, suggestion).people.join('\n'));
  const [uncertainties, setUncertainties] = useState(entry.uncertainties.join('\n'));
  const [pane, setPane] = useState<'original' | 'text'>('text');
  const dirty = JSON.stringify({ ...draft, people: lines(people), uncertainties: lines(uncertainties) }) !== JSON.stringify({ ...entry, visibility: entry.visibility || 'help' });
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function update<K extends keyof EditableEntry>(key: K, value: EditableEntry[K]) {
    setDraft(previous => ({ ...previous, [key]: value, ...((key === 'transcription' || key === 'reading_version' || key === 'reading_corrections') && previous.reading_version_status ? { reading_version_status: 'ai_draft' as const } : {}) }));
  }
  function weatherField<K extends keyof Weather>(index: number, key: K, value: Weather[K]) {
    setDraft(previous => ({ ...previous, weather: previous.weather.map((weather, i) => i === index ? { ...weather, [key]: value } : weather) }));
  }
  const [generating, setGenerating] = useState(false);
  async function generateReading() {
    if (draft.reading_version.trim() && !window.confirm('Replace the current reading version with a new AI draft? Unsaved edits to this version will be replaced.')) return;
    setGenerating(true); setError('');
    try {
      const result = await api<{ reading_version: string; reading_version_status: 'ai_draft' }>('/api/reading-version', { transcription: draft.transcription, reading_corrections: draft.reading_corrections || [] });
      setDraft(previous => ({ ...previous, ...result }));
    } catch (error) { setError(errorMessage(error)); } finally { setGenerating(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<Entry>(`/api/entries/${entry.id}`, {
        ...draft, people: lines(people), uncertainties: lines(uncertainties), revision: entry.revisions.length, source_contribution_id: suggestion?.id,
      });
      onSaved(result, (event.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement && ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value === 'next');
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <section className="entry-editor">
    <div className="editor-heading"><div><p className="eyebrow">CHECK AGAINST THE ORIGINAL</p><h1>{entry.title}</h1><p className="subline">{dirty ? 'Unsaved changes' : 'All changes saved'} · {entry.id}</p></div><div className="editor-actions"><button className="quiet" onClick={onClose} disabled={busy || generating}>Back to entries</button><button className="outlined" type="submit" form="edit-form" disabled={busy || generating}>Save entry</button><button className="primary" type="submit" form="edit-form" value="next" disabled={busy || generating}>{nextExists ? 'Save and next →' : 'Save and finish'}</button></div></div>
    {suggestion && <div className="suggestion-preview"><strong>Use this identification in the entry</strong><p>{suggestion.subject} → <strong>{suggestion.identified_name}</strong>, suggested by {suggestion.author}.</p><p className="hint">Review the proposed people and editorial note below. Saving links this revision to the contribution and preserves the faithful transcription.</p></div>}
    <div className="editor-pane-tabs" role="group" aria-label="Editing view"><button aria-pressed={pane === 'original'} onClick={() => setPane('original')}>Original page</button><button aria-pressed={pane === 'text'} onClick={() => setPane('text')}>Transcription</button></div>
    <div className={`editor-layout mobile-${pane}`}><aside className="editor-scan"><p className="section-label">THE ORIGINAL · CLICK TO ENLARGE</p>{pages.map(page => <figure key={page.id}><button className="source-button" onClick={() => onScan(page.image)} aria-label="Enlarge original page"><img src={page.image} alt={`Original handwritten page: ${page.label}`} /></button><figcaption>{page.label} · The original photograph stays unchanged.</figcaption></figure>)}</aside>
    <div className="editor-text"><form id="edit-form" onSubmit={save}>
      <fieldset disabled={busy || generating}>
        <Input label="Editorial title" value={draft.title} onValue={value => update('title', value)} required />
        <div className="form-row"><label className="field">Transcription quality<select value={draft.status === 'first_pass' ? 'first_pass' : 'checked'} onChange={event => update('status', event.target.value as ReviewStatus)}><option value="first_pass">Draft — needs checking</option><option value="checked">Checked against the original</option></select></label><label className="field">Family visibility<select value={draft.visibility || 'help'} onChange={event => update('visibility', event.target.value as FamilyVisibility)}><option value="private">Private — only the workspace</option><option value="help">Shared for help — invite family input</option><option value="shared">Shared with family</option></select></label></div><p className="hint">Sharing an entry also shares its original page, which may contain other entries.</p>
        <TextArea label="Faithful transcription" rows={8} value={draft.transcription} onValue={value => update('transcription', value)} />
        <section className="reading-corrections" aria-labelledby="corrections-title"><h3 id="corrections-title">Confirmed corrections</h3><p className="hint">Use exact text from the transcription and its confirmed replacement. Applies to names, places, and other wording when generating a reading version. The faithful transcription stays unchanged; People and Place fields are separate.</p>
          {(draft.reading_corrections || []).map((correction, index) => <div className="record-row" key={index}><div className="record-head"><strong>Correction</strong><button type="button" className="remove-record" onClick={() => update('reading_corrections', draft.reading_corrections!.filter((_, i) => i !== index))}>Remove correction</button></div><div className="form-row"><Input label="As written in transcription" value={correction.as_written} list="uncertain-readings" placeholder="[Name?]" required onValue={value => update('reading_corrections', draft.reading_corrections!.map((item, i) => i === index ? { ...item, as_written: value } : item))} /><Input label="Confirmed replacement" value={correction.corrected} placeholder="Correct name or wording" required onValue={value => update('reading_corrections', draft.reading_corrections!.map((item, i) => i === index ? { ...item, corrected: value } : item))} /></div></div>)}
          <datalist id="uncertain-readings">{[...new Set(draft.transcription.match(/\[[^\]\n]+\]/g) || [])].map(text => <option key={text} value={text} />)}</datalist>
          <button type="button" className="add-record" onClick={() => update('reading_corrections', [...draft.reading_corrections || [], { as_written: '', corrected: '' }])}>＋ Add a correction</button>
        </section>
        <TextArea label="Reading version (optional)" rows={4} value={draft.reading_version} onValue={value => update('reading_version', value)} />
        <button type="button" className="outlined" onClick={generateReading} disabled={!draft.transcription.trim()}>{generating ? 'Generating…' : draft.reading_version ? 'Regenerate reading version' : 'Generate reading version'}</button>
        <p className="hint">Generated from the transcription with the confirmed corrections above. Review the draft, then save the entry.</p>
        {draft.reading_version && draft.reading_version_status && <label className="field"><span>{draft.reading_version_status === 'ai_draft' ? 'AI-generated draft — needs review' : 'Reading version reviewed'}</span><span><input type="checkbox" checked={draft.reading_version_status === 'reviewed'} onChange={event => update('reading_version_status', event.target.checked ? 'reviewed' : 'ai_draft')} /> I have reviewed this reading version</span></label>}
        <details className="editor-metadata"><summary>Dates, people, places &amp; editorial notes</summary>
        <div className="form-row"><Input label="Date as written" value={draft.date_as_written} onValue={value => update('date_as_written', value)} /><Input label="Interpreted date" type="date" value={draft.date} onValue={value => update('date', value)} /></div>
<label className="field">Date certainty<select value={draft.date_certainty} onChange={event => update('date_certainty', event.target.value as DateCertainty)}>{['unknown','inferred','probable','certain'].map(value => <option key={value}>{value}</option>)}</select></label>
        <TextArea label="Editorial notes" value={draft.editorial_notes} onValue={value => update('editorial_notes', value)} />
        <TextArea label="People (one per line)" rows={2} value={people} onValue={setPeople} />
        <TextArea label="Uncertainties (one per line)" value={uncertainties} onValue={setUncertainties} />
        <section className="metadata-editor"><h3>Places</h3><p className="hint">Choose a place and one or more roles. Add a map location only when useful.</p>
          <div id="place-fields">{draft.places.map((place, index) => <PlaceEditor key={index} place={place} places={[...places, ...draft.places]} onChange={value => update('places', draft.places.map((current, i) => i === index ? value : current))} onRemove={() => update('places', draft.places.filter((_, i) => i !== index))} />)}</div>
          <button type="button" className="add-record" onClick={() => update('places', [...draft.places, { name: '', role: '', roles: [], precision: 'Not mapped', source: '', latitude: null, longitude: null }])}>＋ Add a place</button>
          <h3>Weather &amp; sea</h3><div id="weather-fields">{draft.weather.map((weather, index) => <div className="weather-row record-row" key={index}>
            <div className="record-head"><strong>Weather</strong><button type="button" className="remove-record" aria-label="Remove weather" onClick={() => update('weather', draft.weather.filter((_, i) => i !== index))}>Remove</button></div>
            <label className="field">Type<select value={weather.kind} onChange={event => weatherField(index, 'kind', event.target.value as WeatherKind)}><option value="recorded">Recorded in the log</option><option value="historical_observation">Historical observation</option><option value="forecast">Forecast</option></select></label>
            <TextArea label="Description" rows={2} value={weather.description} onValue={value => weatherField(index, 'description', value)} /><Input label="Source" value={weather.source} onValue={value => weatherField(index, 'source', value)} />
          </div>)}</div><button type="button" className="add-record" onClick={() => update('weather', [...draft.weather, { kind: 'recorded', description: '', source: 'Handwritten log' }])}>＋ Add weather</button>
        </section></details><p className="hint">Saving preserves the previous version in the revision history.</p>
        {error && <p className="error" role="alert">{error}</p>}<div className="editor-bottom-actions"><button className="outlined">{busy ? 'Saving…' : 'Save entry'}</button><button className="primary" value="next">{nextExists ? 'Save and next →' : 'Save and finish'}</button></div>
      </fieldset>
    </form></div></div>
  </section>;
}
