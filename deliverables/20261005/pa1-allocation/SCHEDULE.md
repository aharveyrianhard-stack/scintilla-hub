# The data file's rebuild, staged for the coordinator (PA2, 5 Oct 2026) — nothing here is scheduled by this branch

The page reads `data-latest.json` beside it. `build.mjs` rebuilds that file in about 15 s with the page's public key and the chart API only (no Fly key, no table write), so the conventional home for the schedule is a GitHub Actions cron that runs the build and commits the file — the "git scraper" pattern (Simon Willison, simonw/git-scraper-template; the same shape GitHub's own docs give for scheduled workflows). Vercel then deploys the commit as it deploys every push to the live branch.

Cadence Alan asked for: nightly after the close, and hourly in session.
- `30 21 * * 1-5` — 21:30 UTC = 17:30 ET, after the close and the Geiger's close reading.
- `5 14-20 * * 1-5` — hourly from 10:05 to 16:05 ET while the session runs.

The workflow file is staged beside this note as `jobs/allocation-data.yml`. It activates only when the coordinator copies it to `.github/workflows/` on the live branch and the repository's Actions setting allows workflows to write (`permissions: contents: write` is in the file). Rules it keeps: it runs on GitHub's runner, never on an existing Fly machine; it reads only; it commits only when the file changed; it carries no secret (the public key is read from index.html as build.mjs does today).

What its neighbours are (Alan, 3 Oct: no new rule without its neighbours): the Vercel deploy on every push (an hourly commit means an hourly deploy of the whole Hub — the coordinator may prefer the nightly line alone until the file moves to a bucket); the chart API's origin rule (build.mjs sends the Hub's origin, as the Hub's own pages do); the universe's served set (a change there changes the rings read).
