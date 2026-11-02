# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## CRM (`/crm`)

A team-only CRM with a map, behind Supabase login: organisations (restaurants, suppliers,
wholesalers, accountants, POS vendors), their contacts and every email, call and visit. It replaces
Spotmapper: tap the map to log a visit, tick who was there, and the dot takes the stage colour.

- Data lives only in Supabase. Row level security lets a signed-in user read or write only when
  their email is in `crm_team`. Nothing CRM-related is ever committed here: this repo is public.
- Schema: `supabase/migrations/20261031212545_cac3e16e-cba9-4b0b-8172-160cb7716b53.sql` (applied by Lovable).
- Add a team member (SQL editor): `insert into public.crm_team (email, name) values ('a@b.nl', 'Firstname');`
  The name is what shows on the @chips and the visit leaderboard. They then sign in on `/crm`
  with a password or a login link.
- Local preview with made-up data, no login: `bun run dev --port 8080`, then open
  `http://localhost:8080/crm?demo=1` (dev server only).
- Map tiles: PDOK BRT achtergrondkaart. Nearby places when logging: OpenStreetMap (Overpass).
  Addresses: PDOK Locatieserver. All free, no keys.

### CRM import (run locally)

`scripts/crm-import.ts` reads the lead files on your own machine and writes them to Supabase as a
team member. It never reads pilot invoice data or anything in `~/truffle-pilots/raw`.

```sh
cd ~/truffle
# 1. Check what would be imported (writes nothing)
CRM_SPOTMAPPER_CSV=~/Downloads/visits-export-....csv bun scripts/crm-import.ts --dry-run
# 2. Import: asks for your team email and emails you a login link; open it on the same Mac
CRM_SPOTMAPPER_CSV=~/Downloads/visits-export-....csv bun scripts/crm-import.ts
```

The link should open a "Signed in" page on `localhost:8789`. If the auth settings don't allow that
redirect, it opens the Truffle site instead: paste that full address into the terminal and the
import carries on.

Sources, all outside this repo: the supplier, accountant and restaurant lead CSVs, the outreach
log and a hand-written overrides file (replies, promises, pilots) in
`~/truffle-pilots/work/external`; the newest `leads-DATE.csv` and `insights-DATE.csv` from the lead
pipeline in `~/truffle-leads/data`; the Spotmapper export. From the pipeline only open or unverified
restaurants and cafes are imported (tag `lead-open` or `lead-unverified`, keyed on `lead_id`), with
the price comparison lines as the card's opener. `--all-leads` also imports the other types, the
places still to check and the likely-closed file (as declined); the map hides those last two until
they are switched on under Filters. Paths can be changed with `CRM_DATA_DIR`, `CRM_LEADS_DIR`, `CRM_OVERRIDES` and
`CRM_SPOTMAPPER_CSV`. Rows without coordinates are geocoded with PDOK and OSM, cached in
`CRM_GEOCODE_CACHE`; places only known by city get the tag `approx-location`.

Every row has a stable `external_ref`, so a re-run only adds new rows and keeps what the team
changed in the app. `--refresh` overwrites imported fields on existing rows.

### Signing in once for scripts

`bun scripts/crm-session.ts login` signs in once (team link via `CRM_JOIN_SECRET`, a password, or
the emailed link) and keeps the session in the macOS Keychain (service `truffle-crm`). After that
the import and other CRM scripts sign in silently, every run swaps the stored token for a new one,
and no new team device is created per run. `status` shows who the session is; `logout` ends it on
the server and removes it. No secret goes into the repo or `.env`.

`scripts/sql/crm-roles-and-audit.sql` (proposed, applied through Lovable) marks such a session as
an importer: it can add and update, delete only untouched pipeline leads, and every change by
anyone is logged in `crm_audit`. The file explains how to mark, revoke and rotate.

### Adding findings without code: patch files

Drop a JSON array in `~/truffle-pilots/work/external/crm-patches/` (or `CRM_PATCH_DIR`), for
example an outreach wave or a hand check:

```json
[{ "ref": "lead:osm:node/123", "tags_add": ["wave-1", "seg-new-operator"],
   "next_step": "Walk in, ask for the owner", "notes_append": "Opened 2025, Tebi, flat white above the area" }]
```

Use `ref` (an organisation's `external_ref`) or `match` (a lowercase name substring). Allowed keys:
`tags_add`, `notes_append`, `next_step`, `next_step_due`, `pitch_angle`, `do_not_contact`. Patches
only add: tags join, a note is appended once, next step and pitch fill empty fields only, and
`do_not_contact` can only be switched on. Stages and deletes stay with people in the app. The
next import applies them to new and existing rows; the dry run reports how many matched.
