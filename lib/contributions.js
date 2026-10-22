import { newContributor } from './contributors.js';
import { randomUUID } from 'node:crypto';
import { AppError, decodePhoto } from './archive.js';

function text(value, label, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new AppError(`${label} is required and must be under ${max} characters.`);
  }
  return value.trim();
}

export const entryVisibility = entry => entry.visibility || 'help';
export function familyArchive(archive, previewId = null) {
  const entries = archive.entries.filter(entry => entryVisibility(entry) !== 'private' || entry.id === previewId);
  const ids = new Set(entries.map(entry => entry.id));
  const pages = new Set(entries.flatMap(entry => entry.page_ids));
  return {
    schema_version: archive.schema_version, volumes: archive.volumes,
    entries: entries.map(entry => ({ ...entry, visibility: entryVisibility(entry), editorial_notes: '', revisions: [] })),
    pages: archive.pages.filter(page => pages.has(page.id)), trips: [], artifacts: [], updated_at: archive.updated_at,
    contributions: (archive.contributions || []).filter(item => item.status === 'approved' && ids.has(item.entry_id)).map(item => ({
      id: item.id, entry_id: item.entry_id, kind: item.kind, author: item.author,
      text: item.text, subject: item.subject, identified_name: item.identified_name,
      photo: item.photo, status: item.status, created_at: item.created_at, context: item.context, target_contribution_id: item.target_contribution_id,
    })),
  };
}

export function submitContribution(store, body, person = null, { allowPrivate = false } = {}) {
  const archive = store.read();
  if (!archive.entries.some(entry => entry.id === body.entry_id)) throw new AppError('Entry not found', 404);
  if (!allowPrivate && entryVisibility(archive.entries.find(entry => entry.id === body.entry_id)) === 'private') throw new AppError('This entry is not open for family contributions.', 404);
  if (!['memory', 'clarification', 'identification', 'photo'].includes(body.kind)) throw new AppError('Choose a memory, clarification, identification or photo.');
  const item = {
    id: `C-${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    entry_id: body.entry_id,
    kind: body.kind,
    author: person?.invited ? person.name : text(body.author, 'Your name', 120),
    text: text(body.text ?? '', body.kind === 'photo' ? 'Photo caption' : 'Your memory or context', 12000, body.kind !== 'identification'),
    subject: '', identified_name: '', photo: null, context: text(body.context || '', 'Context', 2000, false), target_contribution_id: null,
    status: 'pending', created_at: new Date().toISOString(), review_history: [], review_note: '',
  };
  if (item.kind === 'clarification') {
    item.subject = text(body.subject, 'Detail to clarify', 2000);
    const entry = archive.entries.find(entry => entry.id === body.entry_id);
    if (!entry.uncertainties.includes(item.subject)) throw new AppError('This detail is no longer listed as unresolved. Refresh the entry.');
    item.context = item.subject;
  }
  if (item.kind === 'identification') {
    item.subject = text(body.subject, 'Who you are identifying', 500);
    item.identified_name = text(body.identified_name, 'Suggested name', 200);
  }
  if (body.target_contribution_id) {
    const target = (archive.contributions || []).find(target => target.id === body.target_contribution_id && target.entry_id === body.entry_id && target.photo && target.status === 'approved');
    if (!target) throw new AppError('That photograph is not available for identification.');
    item.target_contribution_id = target.id;
  }
  let photoFile;
  if (item.kind === 'photo') {
    if (body.permission !== true) throw new AppError('Confirm you have permission to share the photo with the family.');
    const photo = decodePhoto(body.image);
    if ((archive.contributions || []).some(other => other.entry_id === item.entry_id && other.photo?.sha256 === photo.digest)) {
      throw new AppError('This photo has already been submitted for this entry.');
    }
    const filename = `${item.id}.${photo.kind === 'jpeg' ? 'jpg' : photo.kind}`;
    item.photo = {
      url: `/contribution-photos/${filename}`,
      sha256: photo.digest,
      original_name: text(body.original_name || 'Family photo', 'File name', 255),
      credit: text(body.credit || item.author, 'Photo credit', 200),
      permission: 'family_archive',
    };
    photoFile = filename;
    store.writePhoto('contribution-photos', filename, photo.raw);
  }
  const identity = person ? { person, cookie: null } : newContributor(archive, item.author);
  item.contributor_id = identity.person.id;
  archive.contributions = [...(archive.contributions || []), item];
  try { store.save(archive); } catch (error) {
    if (photoFile) store.removePhoto('contribution-photos', photoFile);
    throw error;
  }
  return { id: item.id, status: item.status, cookie: identity.cookie };
}

export function reviewContribution(store, id, body) {
  const archive = store.read();
  const item = (archive.contributions || []).find(item => item.id === id);
  if (!item) throw new AppError('Contribution not found', 404);
  if (!['pending', 'approved', 'declined'].includes(body.status)) throw new AppError('Unknown contribution status.');
  if (body.revision !== item.review_history.length) throw new AppError('This contribution changed. Refresh the queue before reviewing it.', 409);
  const note = text(body.note ?? '', 'Review note', 4000, false);
  item.review_history.push({ reviewed_at: new Date().toISOString(), previous_status: item.status, previous_note: item.review_note, status: body.status });
  item.status = body.status;
  item.review_note = note;
  item.reviewed_at = new Date().toISOString();
  store.save(archive);
  return item;
}
