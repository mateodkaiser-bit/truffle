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
