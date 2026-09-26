# Agent instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the relevant package/application guide
before changing code. Preserve unrelated working-tree and staged changes.

- Use Bun for package management, scripts and tests. Keep Effect runtime packages
  on the same pinned prerelease. Do not upgrade a runtime to satisfy a tool warning.
- Read the complete installed `node_modules/effect/AGENTS.md`, then its relevant
  examples and declarations. Recheck the installed version after changing branches.
- Before an architecture change, inventory the affected capabilities and unsafe
  boundaries, trace their owners, and apply the deletion test in CONTRIBUTING.
- Prefer schema-backed durable data and tagged errors, `Effect.fn`/`fnUntraced`
  for reusable operations, and `Effect.gen` for workflow bodies. Concrete layers
  belong at the application, subsystem, runtime or test boundary choosing them.
- Select the smallest sufficient existing proof before implementation. New tests,
  assertions and fixtures require an uncovered costly failure and a necessity
  decision; necessary isolated regression coverage must fail before the fix.
- Preserve Bundle, Plan, request and journal identities and dispatch authority.
  Treat publishing as data until execution of the concrete candidate is approved.
- Do not commit or modify `.repos/effect`; it is a local research checkout.
- Report the exact checks run and their limits. A passing source suite does not
  establish installed-package, native-host or live-provider compatibility.
