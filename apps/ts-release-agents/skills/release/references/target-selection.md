# Target selection

Choose only configuration supported by the installed schema:

- Bun-compiled executables use `builds[]` with `builder: "bun"`.
- Imported files use `artifacts[]`; archives and checksums are local
  preparations.
- npm and GitHub Releases use their typed publication sections.
- Homebrew, Scoop, and generic catalog files are rendered as managed local
  bytes; repository delivery requires its typed transport.
- Unsupported provider correction is reported as an explicit typed outcome.

Do not invent profiles, custom providers, hooks, or marketplace submissions.
