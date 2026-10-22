export type ReviewStatus = 'first_pass' | 'checked' | 'ready_to_share';
export type DateCertainty = 'unknown' | 'inferred' | 'probable' | 'certain';
export type WeatherKind = 'recorded' | 'historical_observation' | 'forecast';

export interface Place {
  canonical_name?: string;
  geocoding_source?: string;
  roles?: string[];
  source_type?: string;
  source_note?: string;
  name: string;
  role: string;
  precision: string;
  source: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Weather {
  kind: WeatherKind;
  description: string;
  source: string;
}

export interface ReadingCorrection { as_written: string; corrected: string }

export interface EditableEntry {
  reading_corrections?: ReadingCorrection[];
  title: string;
  date_as_written: string;
  date: string;
  date_certainty: DateCertainty;
  transcription: string;
  reading_version: string;
  reading_version_status?: 'ai_draft' | 'reviewed';
  editorial_notes: string;
  status: ReviewStatus;
  visibility?: FamilyVisibility;
  people: string[];
  places: Place[];
  uncertainties: string[];
  weather: Weather[];
}

export interface Entry extends EditableEntry {
  id: string;
  page_ids: string[];
  trip_ids: string[];
  created_at: string;
  updated_at?: string;
  revisions: { saved_at: string; record: EditableEntry }[];
  source_contribution_ids?: string[];
  provenance: { method: string; model: string | null };
}

export interface Page {
  id: string;
  volume_id: string;
  order: number;
  label: string;
  image: string;
  sha256: string;
  created_at: string;
}

export interface Archive {
  contributors?: Contributor[];
  invitations?: {id: string; name: string; expires_at: string; redeemed_at: string | null}[];
  contributions?: Contribution[];
  schema_version: number;
  volumes: { id: string; title: string; description?: string }[];
  pages: Page[];
  entries: Entry[];
  trips: unknown[];
  artifacts: unknown[];
  updated_at?: string;
}

export interface Config {
  role: 'family' | 'archivist' | 'crew' | 'pending';
  account?: { email: string; status: string } | null;
  contributor?: Contributor | null;
  automatic_transcription: boolean;
  model: string;
}

export interface ImportResult {
  page: Page;
  entry_ids: string[];
}

export const statusLabels: Record<ReviewStatus, string> = {
  first_pass: 'Needs review',
  checked: 'Checked against scan',
  ready_to_share: 'Ready to share',
};

const entryDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export function dateLabel(entry: Pick<Entry, 'date' | 'date_as_written'>) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    const date = new Date(`${entry.date}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === entry.date) return entryDateFormatter.format(date);
  }
  return entry.date_as_written || 'Undated passage';
}

export type ContributionKind = 'memory' | 'clarification' | 'identification' | 'photo';
export type ContributionStatus = 'pending' | 'approved' | 'declined';
export interface Contribution {
  context?: string;
  target_contribution_id?: string | null;
  id: string;
  entry_id: string;
  kind: ContributionKind;
  author: string;
  text: string;
  subject: string;
  identified_name: string;
  photo: { url: string; sha256: string; original_name: string; credit: string; permission: 'family_archive' } | null;
  status: ContributionStatus;
  created_at: string;
  review_note?: string;
  reviewed_at?: string;
  review_history?: { reviewed_at: string; previous_status: ContributionStatus; previous_note: string; status: ContributionStatus }[];
}
export interface ContributionRequest {
  kind: ContributionKind;
  subject?: string;
  prompt?: string;
  target_contribution_id?: string;
}

export type FamilyVisibility = 'private' | 'help' | 'shared';
export interface Contributor { id: string; name: string; invited: boolean; created_at: string }
export interface MyContributions { contributor: Contributor | null; contributions: (Contribution & { entry_title: string; entry_visibility: FamilyVisibility })[] }
export const visibilityLabels: Record<FamilyVisibility, string> = { private: 'Private', help: 'Shared for help', shared: 'Shared with family' };
