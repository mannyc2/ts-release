> Historical pre-0.4 configuration example. The current CLI runs an authored
> application; see the repository README and `docs/preparation.md`. Commands and
> configuration APIs below are not supported by the current implementation.

# Multi-target Scoop template

This template renders one Scoop manifest with x64 and arm64 ZIP downloads.
Both archives must be selected by the paired GitHub release publication; the
catalog subject is dependency-blocked until those upstream asset subjects
converge.

Replace the project, bucket, homepage, artifact, and credential coordinates.
A repository check can prepare this template without publishing, but an actual
release requires explicit provider authority.
