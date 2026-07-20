# Changelog

## Unreleased

### Changed

- Removed the planner `notices` channel from serialized plans/evidence and from public plan, build, and release summaries. Absent config sections now schedule nothing and leave no trace; `NoteAction` operations are the sole informational channel. The structural cut bumps the durable contracts to `release-plan/v4` and `release-evidence/v3` with no compatibility reader.
- Added an optional root `retry: { attempts, delayMillis }` policy. It defaults only verify-phase operations that lack an explicit policy, so npm's built-in version-check retry remains authoritative and publish/build/catalog actions are never retried by this default: mutating commands may have half-succeeded and are not safe to replay generically. The generated config schema changed from 26,846 to 28,118 bytes.
- Added argv-only `hooks.before`, `hooks.after`, and `publish.custom` commands. Before hooks are execute-gated local writes; after hooks default to local writes; custom publishers default to externally visible; after/custom may opt into irreversible approval, and no hook can declare ungated risk. Declared env names are required and redacted. Before hooks run with the build workflow, while after hooks run at the end of publication before verification. The generated config schema changed from 22,688 to 26,846 bytes.
- Removed `publish.pypi.usernameEnv` and `publish.pypi.passwordEnv`; Twine's fixed `TWINE_USERNAME`/`TWINE_PASSWORD` contract is now represented directly, with migration hints for both removed fields. The npm trusted-publishing exclusivity rule and GitHub repository requirement now live with their owning planners without changing their errors; the generated config schema changed from 22,814 to 22,688 bytes.
- Rebased Homebrew and Scoop publication onto the generic catalog render/publish pair. Their generated formula and manifest bytes are unchanged, while operation/artifact ids now use `catalog:*`, simulated validation operations were removed, and both presets support real `validate` commands plus pull-request submission.
- Removed the unsupported `publish.homebrew.tokenEnv` and `publish.scoop.tokenEnv` fields with migration hints. Vendor file paths now use the generic `directory/file` derivation (`tapDirectory`/`bucketDirectory` plus `formulaPath`/`manifestPath`); the generated config schema changed from 22,140 to 22,814 bytes.
- Narrowed the durable `release-plan/v3` action union by removing the producerless `http-check` action and its JSON-check grammar.
- Narrowed `release-evidence/v2` by removing the unreachable HTTP request/outcome variants; GitHub release evidence and the `ReleaseHttp` service remain supported.
- Removed the producerless `sbom` and `signature` artifact kinds from the durable artifact union.
