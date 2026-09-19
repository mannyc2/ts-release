# Release runbook

1. Run `bun install --frozen-lockfile`, `bun run check:portable` and the relevant
   native producer checks. Retain the exact tested source commit and packed files.
2. Prepare and retain the Bundle, content, Plan and application input. Confirm the
   intended destinations and the application's explicit authorization policy.
3. Run `ts-release --observe ./release.mjs ./release-input.json` to inspect current
   evidence. Observation records journal evidence without publication dispatch.
4. Once execution is approved, run `ts-release ./release.mjs ./release-input.json`.
   Retain its JSON report. Follow [recovery](recovery.md) for incomplete progress.

The repository's self-release application is a preparation/validation rehearsal
with dispatch disabled. Public registry publication, actual GitHub releases,
portal submission and hosted Apple service acceptance are separate operational
acceptance. Local fixtures do not establish those outcomes.
