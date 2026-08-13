# Homebrew tap delivery

This runnable example prepares a typed Homebrew formula from the exact digest
of a GitHub release archive, then models delivery of the formula and its
canonical managed-state record to `owner/homebrew-tap`.

Catalog delivery runs only after the GitHub release subjects converge. The Git
Data adapter preserves unrelated repository objects, creates a commit with the
observed branch commit as its sole parent, and updates the branch without
force. Replace every `owner/*` coordinate and the credential reference before
using the example.
