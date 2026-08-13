# Homebrew migration note

This directory is not a runnable ts-release example. The current authored
schema has no Homebrew or generic catalog destination, so the old configuration
was removed instead of being retained as an accepted no-op.

The archived fixture bytes remain only as migration input for a future
provider-owned Homebrew slice. Do not infer publication support from their
presence.
