# Changelog

## Unreleased

### Changed

- Newly persisted build, release, and verification evidence records the
  SHA-256 fingerprint of its source-independent canonical release plan.
  Legacy evidence still decodes, but cannot be used to continue a release.
- Added `release --continue` and the Action `continue` input. A continued
  executed release requires matching fingerprinted evidence and skips only
  operations that previously passed; snapshot continuation is refused.
- Added `verify --published` and the Action `published` input. Under the flag,
  verification derives a read-only operation that re-downloads GitHub release
  assets and checks their bytes against the uploaded sha256/sha512 manifest.
- Internal plan/config validation wording is no longer a compatibility surface;
  typed error tags, fields, and meanings are. No current message changed in
  this release.
- Removed the unimplemented `runtime` Action input; the Action always runs its
  bundled engine.
- Unresolvable template tokens in `builds[].run`, `hooks.*[].run`,
  `publish.custom[].run`, and `catalogs[].validate` now fail the plan with a
  typed error instead of silently rendering as empty strings.
- Made `project` the sole owner of release metadata. New optional `project.description`, `project.summary`, `project.homepage`, and `project.license` fields feed every consumer: PyPI wheels take their METADATA summary from `project.summary` (defaulting to `project.description`), Homebrew and Scoop take their description from `project.description`, and the homepage falls back to the GitHub repository URL when unset. `pypiWheel` is now one wheel family — `packageName`/`moduleName`/`consoleScript`/`requiresPython` stated once with entries under `wheels[]` — and the array/single-entry forms, the per-wheel metadata fields, `publish.homebrew.homepage`/`.description`, and `publish.scoop.homepage`/`.description`/`.license` were removed with targeted migration hints. The silent `"<name> <version> release artifact"` catalog fallback is replaced by precise required-field plan errors naming the missing project fact. Shipped formula/manifest/plan bytes are unchanged by the value-verbatim config migration. The generated config schema changed from 28,493 to 28,796 bytes (SHA-256 `542a47bc35464fd9118bc8bd4e0ae0e3764a26a87adfd30e93556271d5b4133d`).
- Removed the standalone `npm --version`, `python --version`, and `python -m twine --version` validation operations. Surviving npm and Twine work commands remain the plan's executable source of truth, while `doctor` is the single owner of derived toolchain readiness; affected plan and evidence fixtures intentionally lose only those three probe records. The CLI doctor adapter now forwards `--root` and `--config` through the engine's `root`/`configPath` boundary, so explicit relative configs diagnose the requested project.
- Unified explicit artifact selection on `ids` for Homebrew, Scoop, PyPI, and archives. The removed `publish.homebrew.artifactIds`, `publish.pypi.artifactIds`, and `publish.scoop.artifactId` fields have targeted migration hints; Scoop accepts the shared non-empty array shape and then enforces exactly one selected artifact. Selection results and generated catalog bytes are unchanged. The generated config schema changed from 28,118 to 28,493 bytes (SHA-256 `7ace66dfc888fc07d182e144d56c4a3ae06b322cba6074a06dda1c950ac09b54`).
- Routed `build` through the shared evidence executor. Each build now persists `build.json`, including a final failed record when staging fails, and stage actions honor operation retry policies. CLI and Action build stdout remain byte-identical, and the public root `BuildSummary` remains unchanged. The internal engine result replaces plan-derived `stagedOperations` with `evidence`; executor-routed staging failures now surface as `OperationFailedError`, while direct `ArtifactStager` calls retain `ArtifactStageError`.
- Removed the planner `notices` channel from serialized plans/evidence and from public plan, build, and release summaries. Absent config sections now schedule nothing and leave no trace; `NoteAction` operations are the sole informational channel. The structural cut bumps the durable contracts to `release-plan/v4` and `release-evidence/v3` with no compatibility reader.
- Added an optional root `retry: { attempts, delayMillis }` policy. It defaults only verify-phase operations that lack an explicit policy, so npm's built-in version-check retry remains authoritative and publish/build/catalog actions are never retried by this default: mutating commands may have half-succeeded and are not safe to replay generically. The generated config schema changed from 26,846 to 28,118 bytes.
- Added argv-only `hooks.before`, `hooks.after`, and `publish.custom` commands. Before hooks are execute-gated local writes; after hooks default to local writes; custom publishers default to externally visible; after/custom may opt into irreversible approval, and no hook can declare ungated risk. Declared env names are required and redacted. Before hooks run with the build workflow, while after hooks run at the end of publication before verification. The generated config schema changed from 22,688 to 26,846 bytes.
- Removed `publish.pypi.usernameEnv` and `publish.pypi.passwordEnv`; Twine's fixed `TWINE_USERNAME`/`TWINE_PASSWORD` contract is now represented directly, with migration hints for both removed fields. The npm trusted-publishing exclusivity rule and GitHub repository requirement now live with their owning planners without changing their errors; the generated config schema changed from 22,814 to 22,688 bytes.
- Rebased Homebrew and Scoop publication onto the generic catalog render/publish pair. Their generated formula and manifest bytes are unchanged, while operation/artifact ids now use `catalog:*`, simulated validation operations were removed, and both presets support real `validate` commands plus pull-request submission.
- Removed the unsupported `publish.homebrew.tokenEnv` and `publish.scoop.tokenEnv` fields with migration hints. Vendor file paths now use the generic `directory/file` derivation (`tapDirectory`/`bucketDirectory` plus `formulaPath`/`manifestPath`); the generated config schema changed from 22,140 to 22,814 bytes.
- Narrowed the durable `release-plan/v3` action union by removing the producerless `http-check` action and its JSON-check grammar.
- Narrowed `release-evidence/v2` by removing the unreachable HTTP request/outcome variants; GitHub release evidence and the `ReleaseHttp` service remain supported.
- Removed the producerless `sbom` and `signature` artifact kinds from the durable artifact union.
