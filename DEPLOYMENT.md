# Production deployment

The frontend is static React hosted on GitHub Pages. Supabase hosts Auth, Postgres, private photo Storage, and the `ships-log` Edge Function. The function reuses the local Node API routes with bearer-token authentication. Roles always come from the database. Browser roles cannot directly access private tables or Storage objects.

## Release process

Push reviewed changes to `main`, or run **Actions → Deploy → Run workflow**. The deployment workflow:

1. Installs pinned dependencies, checks tracked files for secrets, and runs TypeScript/build/tests using synthetic fixtures.
2. Links Supabase, applies forward SQL migrations, and deploys the Edge API.
3. Builds the GitHub Pages frontend using public configuration variables only.
4. Publishes `dist/` through the GitHub Pages environment.

Deployments run serially. A failed test or backend deployment prevents the frontend release. Pull requests run checks without deployment credentials. Configure required reviewers on the `production` environment if manual release approval is desired.

## GitHub configuration

Repository secret:

- `SUPABASE_ACCESS_TOKEN`: the Supabase management token, encrypted by GitHub Actions. It is used only in the backend deployment job. It is never a Vite variable or a build artifact. Restrict repository collaborator access and rotate this token when access changes.

Repository variables (public configuration):

- `SUPABASE_PROJECT_REF`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (the publishable/anon key, never the secret/service-role key)
- `VITE_EDGE_API_URL`: `https://PROJECT.supabase.co/functions/v1/ships-log`

Pages uses GitHub Actions as its build source. The repository name is `seahawk`, so Vite builds with base `/seahawk/`. The workflow derives this path from the repository name. Production routes use hashes, such as `/seahawk/#/workspace`, which work on reload without server rewrites. Change `VITE_BASE_PATH` in the workflow if the repository path changes.

## Supabase configuration

Set Edge secrets using `supabase secrets set` or the dashboard:

- `APP_ORIGIN`: exact Pages origin, `https://mikemfleming.github.io` (no repository path).
- `OPENAI_API_KEY`: optional AI transcription credential, kept only on Supabase.
- `OPENAI_MODEL`: optional model selection.

The Edge runtime supplies its server credentials. Never copy those into Pages variables. `verify_jwt = false` permits public reading and password-help requests; protected routes validate the bearer token with Supabase Auth and enforce archivist/approved-crew roles themselves. CORS permits only APP_ORIGIN. Private photo URLs are signed after permission checks and expire after one hour; refresh the page if they expire. Do not share private preview URLs/photos.

In hosted Auth settings, keep email/password signup enabled, email confirmation disabled, and password length at least 12. No email service is used. Forgot-password submits a private request; the archivist verifies identity offline, reauthenticates, and sets a replacement password.

Production uses the Supabase browser SDK's session storage and bearer tokens, avoiding third-party cookies between GitHub Pages and Supabase. This differs from the local Node server's HttpOnly cookie sessions. Treat XSS prevention as critical: React escapes content; no raw user HTML is rendered; the static page has a restrictive script policy. Never add third-party scripts without reviewing their access to sessions. Use sign-out on shared devices.

## Local work

Copy `.env.example` to `.env` and supply server-side Supabase credentials. `pnpm build && pnpm start` serves the app at `http://127.0.0.1:8000` with same-origin cookies. Do not set VITE_PAGES/VITE_EDGE_API_URL for this mode. `pnpm test` requires no real database or archive.

For a production frontend build, set the VITE_* variables listed above plus `VITE_PAGES=true` and `VITE_BASE_PATH=/seahawk/`. The browser bundle must never contain OPENAI_API_KEY or SUPABASE_SECRET_KEY.

## Data and secret protection

`.env`, `data/`, photographs, Supabase CLI temporary state, build output, caches, and dependencies are excluded from Git. Only synthetic records/image bytes are used in tests. `pnpm check:secrets` audits the Git index against private paths, known credential patterns, and local secret values. Install the pre-commit hook with `git config core.hooksPath .githooks`. The audit supplements review; it is not a guarantee against every possible secret format.

Keep database and Storage backups independently of Git. CI never imports local archive data and never performs a database reset. Do not rewrite applied migrations: add a new forward migration. For a frontend rollback, redeploy a known-good commit; database rollback requires a separately reviewed forward repair migration. Backend and frontend changes should remain compatible during deployment.

### Load diagnostics

Before adding caching, sign in as archivist and expand **Load diagnostics** at the bottom of the page. It shows navigation-to-journal-render time, total API request count and the latest 30 request records. Measurements live only in this tab's memory. Reload to start a fresh visit; compare a first visit, a repeat visit, and a reload after publishing an edit. No caching has been enabled yet.

API responses carry `X-Request-ID` and `Server-Timing` (also exposed to the cross-origin frontend). In browser DevTools, inspect `/api/config` and `/api/family` in Network. Backend phases are `auth`, `database`, `commit`, `photos`, and `total`; phases only appear when executed. Total excludes response transfer and platform startup before the handler starts. Browser request duration includes session lookup, network and JSON parsing. Journal timing approximates the first rendered entries, not when photos finish downloading.

Search Supabase function logs for the request ID to find the structured `api_request` event: route category, method, status, cache state and phase durations. Queries, record IDs, identities, tokens, signed photo URLs, payloads and exception messages are excluded. Requests rejected by the gateway or CORS before the handler do not have this trace. Native Supabase Auth operations are outside these API measurements. Logs use Supabase's existing retention; no external telemetry service is added.

Run `node scripts/performance-baseline.js` to measure three anonymous sequential config/journal loads. This prints only status, IDs and timings, never archive contents. It measures API loading, not full browser rendering, and does not force a cold start. Save outputs externally for comparison when caching is introduced; do not commit production diagnostics.
