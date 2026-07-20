# Changelog

## Unreleased

### Changed

- Removed `publish.pypi.usernameEnv` and `publish.pypi.passwordEnv`; Twine's fixed `TWINE_USERNAME`/`TWINE_PASSWORD` contract is now represented directly, with migration hints for both removed fields. The npm trusted-publishing exclusivity rule and GitHub repository requirement now live with their owning planners without changing their errors; the generated config schema changed from 22,814 to 22,688 bytes.
- Rebased Homebrew and Scoop publication onto the generic catalog render/publish pair. Their generated formula and manifest bytes are unchanged, while operation/artifact ids now use `catalog:*`, simulated validation operations were removed, and both presets support real `validate` commands plus pull-request submission.
- Removed the unsupported `publish.homebrew.tokenEnv` and `publish.scoop.tokenEnv` fields with migration hints. Vendor file paths now use the generic `directory/file` derivation (`tapDirectory`/`bucketDirectory` plus `formulaPath`/`manifestPath`); the generated config schema changed from 22,140 to 22,814 bytes.
- Narrowed the durable `release-plan/v3` action union by removing the producerless `http-check` action and its JSON-check grammar.
- Narrowed `release-evidence/v2` by removing the unreachable HTTP request/outcome variants; GitHub release evidence and the `ReleaseHttp` service remain supported.
- Removed the producerless `sbom` and `signature` artifact kinds from the durable artifact union.
