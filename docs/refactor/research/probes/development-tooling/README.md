# Development tooling probe

This disposable probe answers five narrow questions:

1. Which candidate Effect/TypeScript patterns occur in the current repository,
   classified by library, application, script, and test scope?
2. Does ordinary TypeScript accept a representative floating Effect and
   Effect execution nested inside another Effect?
3. Does the pinned published Effect language service report those mistakes
   while accepting a deliberate runtime-boundary `Effect.runPromise`?
4. What TypeScript 6 options change diagnostics or emitted NodeNext imports in
   focused fixtures?
5. What cold and warm timings and migration counts do pinned Oxlint and dprint
   produce over the current checkout?

It does not select production configuration. The language-service probe uses
published `@effect/language-service@0.87.0`, whose v4 harness was pinned to
Effect beta.94; applying it to the rc.109 fixture is compatibility evidence,
not an official support claim. Oxlint uses only public standard plugins. The
Effect monorepo's `@effect/oxc` rules are private and are not copied here.
