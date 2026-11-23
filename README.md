# The Seahawk log

A single static page: 73 displayed Ricoh photographs in original page order (pages 5–10 omitted), with the transcription directly beneath each one. Select a photograph to open a larger copy. Brackets preserve uncertain readings.

The public website has no login, database connection, editing interface, or runtime dependency. A separate local server supports corrections. A small local script adds page jumping and an accessible photo viewer with zoom, previous/next pages and arrow-key navigation; the photographs and text remain readable without it. All photographs and text are part of the page's static files. All 79 original full-resolution exports remain untouched.

## Run locally

Use Node 22.12 or newer. No package installation or environment variables are required.

```sh
npm start
```

Open `http://127.0.0.1:8127`. Set `PORT` to use another port.

```sh
npm test
npm run check:secrets
npm run build
```

`dist/` is the complete website and works on any static host. Relative asset paths also work at the existing GitHub Pages `/seahawk/` address. The deployment workflow only builds and uploads static files; it no longer deploys a Supabase backend.

## Source photographs and transcriptions

`web/index.html` contains the ordered page text. `web/photos/` contains display-sized JPEG copies at three resolutions. The page reserves image space and loads later photographs lazily, so opening it does not download every full-size photo at once. No third-party fonts, tracking, account services, or runtime weather/chart APIs are loaded. Maps are currently removed; reading the site makes no map requests. On wide screens the photo stays alongside its transcription. A sticky page selector and year navigation preserve the original page numbers, uncertain readings have subtle highlights, and a back-to-top link helps navigate the long page. Space opens/closes the viewer for the page currently in view; zoom is retained while paging through displayed originals. Reading position is saved only in browser local storage and restored on the next visit without a specific page link. Weather uses a compact, expandable summary; full measurements and sources are available inside.

To rebuild these files from the private intake, install Pillow for a Python interpreter and run:

```sh
GALLERY_PYTHON=/path/to/python3 node scripts/export-gallery.js
```

Optional positional arguments specify the intake folder and archive snapshot. The exporter verifies all original photo hashes, retains printed text, carries forward confirmed passage corrections, escapes text for HTML, and preserves manifest order. The ordinary build does not require Python, the private intake, or credentials.

The previous application and its uncommitted source are preserved under ignored `data/intake/seahawk/previous-app/`, with an additional source archive and patch alongside it. Existing remote Supabase records and accounts have not been deleted.

## Publication

The website has no access control. Publishing `dist/` makes all its photographs and transcriptions accessible, including contact information visible in the originals. Local preparation does not publish anything or change the previous live site.


## Historical weather and weekly music

Each journal entry is grouped with its own compact weather and weekly music directly beneath that entry’s transcription. Maps are currently removed. Weather always uses Port Aransas, Texas through the July 10–11 entry on page 44, then Kona, Hawaii for every subsequent passage, including the remaining entries on page 44. These home ports were supplied by the owner; place names in the text never choose the weather location.

Dated entries show daily temperature, rainfall, maximum wind and gusts from Open-Meteo ERA5 reanalysis, a roughly 25 km regional reconstruction rather than an observation aboard the boat. Multi-day entries show each day's weather. The original recorded weather remains in the transcription.

Weekly music is the U.S. Billboard Hot 100 top 10 for the chart issue dated within the seven-day week containing the entry, sourced from the public `mhollingshead/billboard-hot-100` archive with links to Billboard. No lyrics or audio are embedded.

Dates are resolved across the chronological book, using photograph-reviewed year transitions in `content/chronology.json`. This carries years across page boundaries, corrects misread date headings in context metadata, and handles multi-day entries. Small backward day movements do not invent a new year. The loose retrospective insert on page 77 keeps its explicit April 29, 2000 date. July 2004 has no recorded day, so it gets no invented daily weather or chart. Undated continuations remain undated. The first-pass transcription is preserved separately; interpreted dates are labeled.

`content/entry-context.json` contains the prepared weather and charts. `content/entry-layout.json` stores text anchors connecting each entry to the full-page transcription; `node scripts/prepare-entry-layout.js` can regenerate those anchors from the private intake without changing the wording. Normal builds need no network or credentials. To refresh from the private intake snapshot, run `npm run context:refresh` with network access. It sends only the two home-port coordinates and dates to Open-Meteo and dates to the approved public chart archive, never images or full transcriptions. Responses are cached under ignored `data/intake/seahawk/context-cache/`.

## Local corrections and the public website

`npm start` enables local editing. Select **Edit entry**, correct the transcription or add an optional family clarification, then select **Save correction**. Changes are stored in `content/corrections.json` and survive restarts. Original text and photographs stay untouched. Commit corrections and push to `main` when ready to publish them. Your dad can use this editor on this computer; collaborating across computers currently requires sharing/synchronizing the project through Git, not the public website.

`npm run preview` serves the same read-only result as GitHub Pages. `npm run build` produces `dist/` with no editing controls or save API. The `local/` editor directory is never copied into that artifact.

Display photos are committed under `web/photos/` and served from GitHub Pages; the full-resolution originals and preparation records remain in ignored `data/intake/seahawk/`. See [technical design](docs/technical-design.md).

## Elsewhere that week and the economy

`content/weekly-context.json` supplies two optional, collapsed sections under dated entries. “Elsewhere that week” uses up to three short event excerpts from Wikipedia's year timelines, credited to Wikipedia contributors under CC BY-SA 4.0. These are retrospective historical events, not contemporary newspaper headlines or a complete news digest. The window is the seven calendar days ending on the entry date; no later events are included.

The economy panel uses public ALFRED CSV downloads without an API key. Each series is downloaded separately and its CSV header must confirm the requested vintage date. Unemployment (UNRATE) and year-over-year CPI inflation (CPIAUCSL, calculated from that same vintage) are monthly indicators available as of the entry date, with their reference months shown. Missing vintage data is left unavailable rather than replaced with today's revised history.

Refresh with `python3 scripts/prepare-weekly-context.py` using a Python environment with `lxml`. Public responses are cached in the ignored intake folder. The build and website require neither Python nor network access. No NYT or FRED API key is used.

The economy panel also shows the S&P 500 price-index close and its change from the preceding calendar week, sourced from Yahoo Finance's public historical chart download without an API key. Both endpoints use the last available trading close on or before the target date; actual dates and the baseline value are displayed. Dividends are excluded. Market history is a separate historical-price dataset, not an ALFRED economic vintage. Invalid or stale data is omitted.

## Entries that span pages

`content/entry-groups.json` records reviewed continuation relationships. The build extracts stable passages from the source photographs, then renders each logical entry once with an ordered list of passages. The 185 original passage IDs remain correction keys. Seven formerly unaddressable fragments have additional stable IDs; the July 10/11 boundary on page 41 is split without changing source wording. Undated passages are not joined automatically.

Each passage keeps its source page, correction and family note. A “View original” button opens the corresponding photo. Photographs and original page anchors stay in page order; continuation pages link back to the complete entry. Weather, music, historical events and the economy appear once after the final passage. The entry's last-updated label uses its most recently saved passage.

The local editor edits a single passage at a time and names the complete entry and source pages in the dialog. Existing correction keys and notes remain independent. One correction already contained the page 29 continuation; `scripts/migrate-continuation-corrections.js --write` split that saved text at its reviewed paragraph boundary, preserving the exact combined wording and original timestamp. The original correction file is backed up under ignored `data/intake/seahawk/refactor-backups/`. The migration is idempotent and refuses to overwrite an existing destination correction. To correct a grouping later, change only the reviewed relationship in `content/entry-groups.json`.

## Page artifacts

In the local editor, choose **Add artifact to page …** below a page’s transcription. Drag a rectangle over the photograph to select a drawing or detail, choose a type, add a title and optional caption, then **Save artifact**. **Use whole page** clears the crop. Saved cards have an **Edit artifact** button for later changes.

Artifacts are independent page content stored in `content/artifacts.json`, with stable IDs, source page, type, title, caption, normalized crop and creation/update times. Crops display the existing source photograph without altering it or creating another image copy. Transcription corrections and family notes stay in `content/corrections.json`. Adding an artifact does not remove an existing illustration placeholder from the transcription.

Build and publish normally to include artifacts on the read-only public site. The public build includes the rendered cards and source-photo links, never editing controls or save endpoints.
