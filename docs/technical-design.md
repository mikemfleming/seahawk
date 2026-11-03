# Seahawk — Technical Design

**Purpose:** A simple public website presenting Captain Eddie’s fishing journal, from Port Aransas to Kona, 1994–2004.

**Two versions:** `npm start` runs the local editing version on `127.0.0.1:8127`. `npm run build` creates the read-only `dist/` website deployed to GitHub Pages. Local editor assets and save endpoints are never included in `dist/`.

**Architecture:** HTML, CSS and JavaScript, with a Node.js preparation/build pipeline. GitHub Pages requires no login, database, credentials or runtime weather/chart API.

**Content and photos:** 73 displayed photographs remain in original order. The repository contains 79 photographs at three display resolutions (900, 1800 and 3000 pixels wide), including the six omitted pages. GitHub Pages serves those copies directly. Full-resolution source exports, first-pass drafts, import manifests, API caches and previous-app backups remain in the ignored `data/intake/seahawk/` working folder. That folder is preparation material, not required to build or read the site.

**Reading:** An original fish drawing anchors the header. Photo and transcription appear side by side on wide screens. Page/year navigation, a keyboard-accessible photo viewer and browser-local reading position support browsing. Weather and music expand beneath their matching entry.

**Historical context:** Prepared JSON supplies interpreted dates, Open-Meteo ERA5 weather and archived Billboard Hot 100 top tens. Weather uses Port Aransas through July 10–11 on page 44 and Kona thereafter. Preparation caches service responses; normal builds are offline.

**Local corrections:** “Edit entry” opens plain-text transcription and optional family-note fields. Explicit Save writes `content/corrections.json` atomically and refreshes the rendered entry. Corrections are escaped when rendered; the original transcription and photos remain unchanged. Concurrent stale saves are rejected. Git commits provide durable version history. Changes remain local until committed and deployed. This does not yet synchronize two people's computers or provide a shared remote editor.

**Local access:** Editing must be enabled explicitly by the server command. Saves require the loopback host, matching browser Origin and JSON content type. The server binds only to `127.0.0.1`. Static/public preview mode rejects writes and exposes no editor endpoints.

**Publication:** Pushes to `main` trigger GitHub Actions checks, build and Pages deployment. Only `dist/` is uploaded as the website. Repository source and committed display photos are public; rendered corrections and family notes become public at deployment.

**Validation:** Checks cover photo order, transcription preservation, entry/date/weather/chart associations, escaped corrections, local saves, stale-write rejection and absence of editing functionality from the public build. Browser review verifies visual changes.
