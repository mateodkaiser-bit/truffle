# CLAUDE.md for Truffle

@AGENTS.md

`AGENTS.md` (imported above) is the shared rulebook for every agent: project context, the data and
privacy rules, and how to work with the Lovable sync. Keep rules there, not here, so agents other
than Claude Code get them too. This file only adds notes for Mateo's own Claude Code sessions.

## Notes for Mateo's sessions

- The full project handoff (pilot names, terms, evidence tiers, open questions) is in
  `docs/private/bys-handoff-2026-10-21.md`. It is kept out of git through `.git/info/exclude`
  because this repo is public. Read it before planning pipeline work; never copy names or terms
  from it into committed files.
- `.claude/launch.json` has a `truffle-dev` entry (`bun run dev --port 8080`), also kept local via
  `.git/info/exclude`.
- Lint and type baseline at `c8ab8b7` (2026-10-21): `bun run lint` 195 problems (189 errors,
  6 warnings); `npx tsc --noEmit` 3 errors, all the missing `@supabase/supabase-js`.
- This repo follows the same Lovable round-trip procedure used for the Frisbee frontend in
  `~/frisbee` (fetch latest `main` first, scoped edits, push promptly, never force-push).
