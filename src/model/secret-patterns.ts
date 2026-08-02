// The one home for token-shaped denylist patterns. Load-bearing for three
// surfaces: durable-plan validation, ledger output redaction, and the shipped
// plugin checker — additions here are cheap and wide.
export const secretPatterns: ReadonlyArray<RegExp> = [
  /ghp_[A-Za-z0-9]{20,}/u,
  /gho_[A-Za-z0-9]{20,}/u,
  /github_pat_[A-Za-z0-9_]{20,}/u,
  /xox[abps]-[A-Za-z0-9-]{10,}/u,
  /AKIA[0-9A-Z]{16}/u,
  /npm_[A-Za-z0-9]{30,}/u,
  /-----BEGIN [A-Z ]*PRIVATE KEY/u
]
