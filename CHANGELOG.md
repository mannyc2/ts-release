# Changelog

## Unreleased

### Changed

- Narrowed the durable `release-plan/v3` action union by removing the producerless `http-check` action and its JSON-check grammar.
- Narrowed `release-evidence/v2` by removing the unreachable HTTP request/outcome variants; GitHub release evidence and the `ReleaseHttp` service remain supported.
- Removed the producerless `sbom` and `signature` artifact kinds from the durable artifact union.
