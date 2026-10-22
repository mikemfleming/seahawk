# The Ship’s Log

A React + TypeScript family fishing journal with a Node.js API, Supabase Auth, Postgres, and private Supabase Storage. Requires Node.js 22.12+ and pnpm. Hosted Supabase is the selected backend. Production startup requires Supabase; there is no shared archivist password or filesystem fallback.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages, Supabase Edge Functions, CI, secrets, and release/rollback instructions. Public source excludes local archive records and photos. Production uses browser bearer sessions; local Node uses HttpOnly cookies.

## First-time local setup

1. Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/). The Supabase CLI is installed as a project dev dependency; Docker runs its database, Auth, Storage, Studio, and email inbox.
2. Run `pnpm install --frozen-lockfile`, then `pnpm supabase:start`. The CLI creates the local stack, applies `supabase/migrations`, and prints connection details. Use `pnpm supabase:status` to see them again. First startup downloads container images.
3. Copy `.env.example` to `.env` **without overwriting an existing `.env`**. Preserve any existing `OPENAI_API_KEY`. Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` from the local stack. The legacy `anon` key can be used as the publishable key and `service_role` as the secret key if those are what your CLI shows. Every key stays on the Node server; never use a `VITE_` prefix or commit `.env`.
4. Set `APP_ORIGIN=http://127.0.0.1:8000`. Use that exact browser origin. `PORT` defaults to 8000.
5. With the app stopped, run `pnpm db:migrate` to copy the existing `data/archive.json` and its original/contribution photographs to Supabase. Local originals remain intact. The destination must be empty; the command refuses to overwrite an existing archive. Existing contributions keep their original attribution. Legacy browser sessions and invitation links are not migrated, and names never automatically claim old submissions.
6. Run `pnpm build` and `pnpm start`, then open <http://127.0.0.1:8000>. Create your own email/password account with **Sign in / Join the crew**. No confirmation email is required.
7. Run `pnpm archivist -- your-email@example.com`. This server-only bootstrap command promotes that account to archivist. Sign in again and open the workspace. There is no first-signup-wins rule, default password, or role picker in signup.

Use `pnpm supabase:stop` to stop the local stack. Do not reset the database after importing real data. Keep backups of both the database and Storage objects; a JSON export alone does not contain photographs.

## Hosted Supabase setup

Create a project in the [Supabase dashboard](https://supabase.com/dashboard), link it using `pnpm exec supabase link --project-ref YOUR_PROJECT_REF`, and apply the migration with `pnpm exec supabase db push`. Put its URL, publishable key and server secret key into `.env`. Configure the following in the project dashboard:

- Set Auth Site URL to your exact `APP_ORIGIN`, and allow `APP_ORIGIN/auth/callback` as a redirect URL. Use HTTPS for a hosted app. The server sets Secure cookies when APP_ORIGIN uses HTTPS. Configure your trusted TLS reverse proxy to preserve this public origin; the Node listener remains on loopback.
- Enable email/password signup and **disable Confirm email**. Disable anonymous sign-ins. Require at least 12-character passwords; enable leaked-password protection where available. Configure Auth rate limits. No SMTP/email service is needed: email addresses are login identifiers, not verified proof of identity. Verify crew members offline before approval.
- Do not configure email-based recovery or password-change notification emails. The app's Forgot password flow records a private request for the archivist instead of sending mail. Disable any Supabase password-change email notification settings if previously enabled.
- Keep refresh-token rotation enabled and configure appropriate session timeouts. Supabase handles password hashing and sessions; the archivist handles identity verification and recovery offline.

Run the archive migration and archivist bootstrap steps above against the configured project. Project creation and the initial archivist identity require your own account. Never share the server secret key with browser code or users.

## Permissions and accounts

| Role | Read public entries and approved contributions | Submit memories, photos, names and clarifications | Review crew requests and contributions | Import, transcribe, edit, map, and share entries |
| --- | --- | --- | --- | --- |
| Public visitor | Yes | No | No | No |
| Pending / declined account | Yes | No | No | No |
| Approved crew | Yes | Yes | No | No |
| Archivist | Yes, including private entries | Yes | Yes | Yes |

New accounts start as pending crew, with no contribution access. Archivist approval is required; email ownership is not verified. **Workspace → Crew requests** lists requests with approve/decline controls and lets the archivist revoke approved access. Every decision has a database audit record. Role and approval values come from a server-read profile, never signup metadata. Only the server secret can update them; approval changes apply on the next request.

Approved crew submit memories (with optional photos), suggested identifications, and clarifications tied to unresolved details. All additions start pending and appear publicly only after archivist review. Private review notes stay out of public and personal APIs. **Your contributions** follows the account across devices and shows only that account’s submissions. Revoked accounts cannot submit or access private submission history/photos. Public reading remains available.

Signup and sign-in use Supabase Auth without email confirmation. **Forgot password** accepts the account email, returns the same response for existing and unknown accounts, and adds one pending private password-help request for a matching account. Duplicate pending requests are coalesced. It never sends email or changes a password automatically.

The workspace dashboard counts pending account requests. **Workspace → Crew requests → Password-help requests** shows the person's name, login email, and request time. The archivist verifies their identity in person, confirms that verification, enters a replacement password twice, and reenters their own archivist password. The server updates the password through the Supabase Admin API, revokes refresh sessions using an isolated temporary sign-in, and records completion with the reviewing archivist. Passwords are not saved in request/audit rows, logged, or returned in responses. Share the replacement in person and ask the person to change it after signing in. A compromised sole archivist account must be recovered by the project owner through Supabase administration.

Ordinary password changes still require the current password. New passwords require 12–128 characters. Successful changes revoke refresh sessions globally; already-issued access tokens can remain usable until their configured expiry. The local Node server uses HttpOnly, SameSite cookies. GitHub Pages uses Supabase SDK browser sessions and bearer tokens; see DEPLOYMENT.md for the production security model. JSON write routes reject cross-origin and cross-site browser requests. Auth actions and manual reset attempts are locally throttled alongside Supabase Auth limits. The password-help migration enables RLS and denies browser roles direct access; only the server can create or review requests.

For a previously configured hosted project, apply the additional migration with `pnpm exec supabase db push`, turn off Auth **Confirm email**, and disable auth email notifications. Existing unconfirmed accounts may need the project owner to confirm them manually in Supabase; new signups will not require mail.

## Archive and transcription workflows

- Public journal at `/`, stable entries at `/entries/:id`, atlas at `/atlas`. Private entries and their exclusive originals are hidden from public APIs. Sharing an entry shares its complete original page, which may contain several entries.
- Archivist workspace at `/workspace`, with task queues, an original-page upload dialog, source/transcription editor, contribution review, crew approvals, and private-entry preview.
- Upload JPEG, PNG or WebP log-page photographs up to 12 MB. Set `OPENAI_API_KEY` for faithful automatic transcription; `OPENAI_MODEL` defaults to `gpt-4.1`. Manual transcription works without a key. Automatic import can split distinct entries and creates private drafts for review. Only an explicit automatic transcription request sends a photo to OpenAI.
- Keep faithful transcription separate from the generated reading version. Confirmed `as_written` → `corrected` mappings resolve uncertain names and words for generation without rewriting the original. Reading drafts remain labeled AI-generated until reviewed. Generate changes the editor draft; Save persists it and revision history.
- Place editing supports manual latitude/longitude, pasted GPS coordinates, map pins, and explicit precision/source notes. AI-imported coordinates are cleared. City/state lookup is available on demand. OpenStreetMap tiles and Open-Meteo lookup/forecast require network access; historical weather is not inferred.
- Contribution approval never automatically changes the source text. Approved identifications can be applied as explicit, revisioned entry edits. GPS positions, reading corrections, and metadata use the same saved revision workflow.
- Export archive JSON and print family drafts from the workspace. Rebuild frontend source after edits.

## Storage and security boundary

Archive records are stored as a versioned JSONB document in Postgres, preserving the existing archive schema and revision history. Each API request owns an isolated snapshot; a transactional compare-and-swap rejects conflicting writes with HTTP 409 instead of losing changes across processes. Reload before retrying a conflicting edit. Profiles and membership-review history have separate tables.

Photographs live in the private `archive-photos` Storage bucket. Browser requests go through Node authorization; there are no public bucket URLs. RLS is enabled and browser roles have no direct access to archive/profile/review tables or private objects. Server RPC functions are restricted to `service_role`. The server secret bypasses RLS, so the Node API is the authorization boundary; keep it private. Unreferenced private photos can remain after an ambiguous database/network failure and may need maintenance cleanup. A failed commit never intentionally deletes an object that might already be referenced.

The old filesystem adapter, password session module, and legacy invitation helpers remain only to run the existing isolated compatibility tests. `npm start` cannot select those adapters; it requires Supabase credentials. Existing local files are retained as migration sources. The app does not send custom invitation messages or create hosted accounts automatically. GitHub Actions publishes the static frontend and Edge API.

## Development and checks

`pnpm dev:server` runs the Node API with file watching. `pnpm dev` runs Vite at <http://127.0.0.1:5173>. For this two-server setup set `APP_ORIGIN=http://127.0.0.1:5173`, update local Supabase Site URL and redirect allowlist to match, and use Vite’s origin throughout the auth flow. Production uses port 8000 by default.

`pnpm test` runs TypeScript checks, a production build, and Node tests. Existing archive/transcription tests use temporary filesystem fixtures. Supabase tests exercise authorization, account identity, manual password-help rules, photo handling, and concurrent-commit conflicts with mocked services. They do not validate a live Postgres migration, hosted Auth configuration, or Supabase container health. Test those end to end with the local stack before deployment.

Main files: `server.js`, `lib/supabase-auth.js`, `lib/supabase-store.js`, `supabase/migrations/20261022000000_archive_auth.sql`, `web/src/components/WorkspaceLogin.tsx`, and `web/src/components/CrewRequests.tsx`.
