<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Agent guide for Truffle

Read this before you change anything. It is written for any coding agent (Claude Code, Codex,
Cursor and the like) and for the people driving them. The block above is managed by Lovable;
leave it exactly as it is and write below it.

## What the project is

Truffle is a student project from a TU Delft sales course, run by a five-person team with no legal
entity. It is aimed at newer independent restaurants in the Netherlands (open under 5 years, 1 to 3
sites, not yet reliably profitable).

The product idea: an owner hands over their supplier invoices, plus POS sales data where they have
it, and gets back a short list of actions by email or WhatsApp. No login and no dashboard. Each
message leads with "do this", then the euro impact and the evidence, with a backing table behind it.

Three insight modules are planned, in this order:

1. **Overcharging detection.** Did the supplier bill something different from what was agreed or
   delivered? From invoices alone: price jumps against the same product's own history, duplicate
   invoices or lines, arithmetic errors (quantity times price, VAT), unit switches that hide a price
   rise. A flag is a prompt to check, never an accusation.
2. **Renegotiation support.** Where does the owner have leverage? Spend concentration per supplier,
   price drift per product, volume growth, the same product bought cheaper elsewhere. Output is one
   or two concrete asks per supplier, with numbers.
3. **Margin calculation.** Cost per category and its drift (invoices only), then category margin
   (needs POS sales), then item margin (needs recipes; a stretch goal). Never show a precise item
   margin without a recipe source.

None of this has been validated on a real invoice yet. Every savings figure in project material is
a placeholder. Don't write copy or code that presents one as a finding.

What is in the repo today: the Truffle landing site, built in Lovable (TanStack Start, React 19,
Tailwind v4, shadcn/ui, Supabase). The invoice pipeline is next, built and tested on synthetic data
first: a fake "digital twin" of 3 to 5 restaurants with planted issues recorded as ground truth, so
each module can be scored on precision and recall.

## Data and privacy rules (hard rules)

This repo is **public on GitHub** and it syncs to Lovable, a hosted AI service. So anything
committed here is published and passes through an AI tool.

- **Never commit real restaurant data**: invoices, POS exports, supplier price lists, delivery
  notes, recipes, or anything derived from them (parsed tables, caches, screenshots, test fixtures
  copied from real files). Synthetic data only.
- **Never name pilot restaurants, owners or their suppliers' terms** in code, commits, fixtures,
  comments or docs. Use made-up names in synthetic data.
- **Don't point an AI tool at real pilot data**, and that includes your coding agent. At least one
  pilot agreed on the condition of no AI on their data. Until the team settles this, the real-data
  path must be deterministic (OCR plus rules, no model calls) and must run locally.
- **No hosted services that retain data** for anything real. Keep real data local, encrypted where
  possible, and outside this repo.
- **Deletion from day one.** Pilot data must be deleted within 4 weeks. The pipeline needs one
  command that removes raw files, parsed tables and caches and writes a log entry, with a test.
- The team is individuals, not a company: nothing in code, metadata or contracts should imply a
  legal entity. Don't hard-code pricing; the business model is still open.

If a task seems to need real data, stop and ask the person you work for.

## How to work in this repo (Lovable sync)

Lovable reads and writes the `main` branch of this GitHub repo. Every Lovable edit lands on
`origin/main`, and every commit pushed to `origin/main` appears in the Lovable editor and becomes
the base for the next Lovable prompt. Teammates may be editing in Lovable while you work.

So all code written here must end up on `origin/main`, and you can never assume your checkout is
current. Every time:

1. **Start from the latest `main`.** Before touching a file, run `git fetch origin` and
   `git status`. If you are behind, `git pull --rebase origin main` first. Working from a stale
   checkout silently drops Lovable's edits when you push.
2. **Make scoped edits.** Change only the lines the task needs and match the surrounding style.
   Never run a repo-wide formatter or fixer (`bun run format`, `prettier --write .`,
   `eslint --fix .`). The Lovable code is not formatter- or lint-clean, and reformatting it creates
   churn that collides with the next Lovable edit. Formatting files you created is fine.
3. **Add no new lint or type errors.** Compare against the latest `main` before your change, not
   against zero. Then check that `bun run build` and `bun run test` pass.
4. **Commit and push to `main` soon.** Fetch again right before pushing. If the push is rejected
   because Lovable pushed in the meantime, `git pull --rebase origin main`, resolve conflicts
   keeping Lovable's changes as well as yours, re-check, and push again. Work that sits in local
   commits is invisible to Lovable and gets harder to merge the longer it waits.
5. **Keep `main` working.** Lovable builds and previews whatever is on `main`; never push a broken
   build.

A branch or pull request is fine for bigger work, but Lovable only sees it once it is merged into
`main`. Merge soon, and re-check against the latest `main` first.

### Never

- Force-push, or rebase, amend or squash commits that are already on `origin/main`. It rewrites
  Lovable's project history.
- Delete or hand-edit Lovable-managed files: `.lovable/`, `src/routeTree.gen.ts` (generated),
  `src/integrations/supabase/*`, `bunfig.toml`, and the Lovable block at the top of this file.
- Add plugins to `vite.config.ts` that `@lovable.dev/vite-tanstack-config` already includes (the
  comment at the top of that file lists them). Duplicates break the app.
- Add entries to `minimumReleaseAgeExcludes` in `bunfig.toml` (the 24-hour supply-chain guard)
  without asking the repo owner.
- Change the Supabase schema without asking the repo owner how schema is owned for this project.

## Local setup

- Toolchain: Bun. `bun.lock` is the lockfile, so use `bun install` and `bun add`, not npm.
- `bun install`, then `bun run dev --port 8080` for the dev server. `bun run build`,
  `bun run test` and `bun run lint` do what they say.
- `.env` is committed by Lovable and holds only the Supabase URL and publishable keys. Never add a
  secret key to it or to any committed file.

## Known issues

- `src/integrations/supabase/*` imports `@supabase/supabase-js`, which is not in `package.json`.
  The build passes because nothing imports those files yet, but `npx tsc --noEmit` reports it.
  Check whether Lovable has added the dependency before adding it yourself.
- `bun run lint` fails on the Lovable baseline (about 190 errors on 2026-10-21, mostly
  formatting). See rule 2 above: don't fix it wholesale.
