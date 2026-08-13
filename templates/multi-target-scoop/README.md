# Multi-target Scoop template

This template renders one Scoop manifest with x64 and arm64 ZIP downloads.
Both archives must be selected by the paired GitHub release publication; the
catalog subject is dependency-blocked until those upstream asset subjects
converge.

Replace the project, bucket, homepage, artifact, and credential coordinates.
A repository check can prepare this template without publishing, but an actual
release requires explicit provider authority.
