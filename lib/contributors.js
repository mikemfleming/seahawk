import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppError } from './archive.js';

const COOKIE = 'ships_log_contributor';
const DAYS = 90 * 24 * 60 * 60 * 1000;
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function contributorCookie(token) {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DAYS / 1000}`;
}
export function getContributor(req, archive) {
  const token = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const session = (archive.contributor_sessions || []).find(session => session.hash === hashToken(token) && Date.parse(session.expires_at) > Date.now());
  return session ? (archive.contributors || []).find(person => person.id === session.contributor_id) || null : null;
}
export function newContributor(archive, name) {
  const token = randomBytes(32).toString('base64url');
  const person = { id: `R-${randomUUID()}`, name, invited: false, created_at: new Date().toISOString() };
  archive.contributors = [...(archive.contributors || []), person];
  archive.contributor_sessions = [...(archive.contributor_sessions || []).filter(session => Date.parse(session.expires_at) > Date.now()), { hash: hashToken(token), contributor_id: person.id, expires_at: new Date(Date.now() + DAYS).toISOString() }];
  return { person, cookie: contributorCookie(token) };
}
export function ownContributions(archive, person) {
  return (archive.contributions || []).filter(item => item.contributor_id === person?.id && person).map(item => ({
    id: item.id, entry_id: item.entry_id, entry_title: archive.entries.find(entry => entry.id === item.entry_id)?.title || 'Archived entry',
    kind: item.kind, author: item.author, text: item.text, subject: item.subject, identified_name: item.identified_name, entry_visibility: archive.entries.find(entry => entry.id === item.entry_id)?.visibility || 'help',
    photo: item.photo, status: item.status, created_at: item.created_at,
  }));
}
export function createInvitation(store, body) {
  const archive = store.read();
  const target = body.contributor_id ? (archive.contributors || []).find(person => person.id === body.contributor_id) : null;
  if (body.contributor_id && !target) throw new AppError('Contributor not found', 404);
  const name = target?.name || body.name;
  if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new AppError('Enter the family member’s name (up to 120 characters).');
  const token = randomBytes(32).toString('base64url');
  const invitation = { id: `I-${randomUUID()}`, name: name.trim(), contributor_id: target?.id || null, token_hash: hashToken(token), created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), redeemed_at: null };
  archive.invitations = [...(archive.invitations || []), invitation];
  store.save(archive);
  return { id: invitation.id, name: invitation.name, path: `/join/${token}`, expires_at: invitation.expires_at };
}
function findInvitation(archive, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError('This invitation is invalid or has expired.', 404);
  const invitation = (archive.invitations || []).find(invite => invite.token_hash === hashToken(token) && !invite.redeemed_at && Date.parse(invite.expires_at) > Date.now());
  if (!invitation) throw new AppError('This invitation is invalid, already used, or has expired.', 404);
  return invitation;
}
export function invitationInfo(archive, token) {
  const invitation = findInvitation(archive, token);
  return { name: invitation.name, expires_at: invitation.expires_at };
}
export function redeemInvitation(store, req, token) {
  const archive = store.read();
  const invitation = findInvitation(archive, token);
  const current = getContributor(req, archive);
  let person = invitation.contributor_id ? archive.contributors.find(person => person.id === invitation.contributor_id) : current && !current.invited ? current : null;
  if (!person) {
    person = { id: `R-${randomUUID()}`, name: invitation.name, invited: true, created_at: new Date().toISOString() };
    archive.contributors = [...(archive.contributors || []), person];
  }
  person.name = invitation.name;
  person.invited = true;
  const sessionToken = randomBytes(32).toString('base64url');
  archive.contributor_sessions = [...(archive.contributor_sessions || []).filter(session => Date.parse(session.expires_at) > Date.now()), { hash: hashToken(sessionToken), contributor_id: person.id, expires_at: new Date(Date.now() + DAYS).toISOString() }];
  invitation.redeemed_at = new Date().toISOString();
  invitation.contributor_id = person.id;
  store.save(archive);
  return { person, cookie: contributorCookie(sessionToken) };
}
