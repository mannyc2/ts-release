# GitHub Actions Trusted Publishing

This workflow is the action-first trusted-publishing starting point kept at the
older template path for compatibility. The canonical copyable templates now live
under `templates/github-actions/`.

Before enabling the execute job, configure:

- a protected GitHub environment named `release`
- npm trusted publishing for the package and workflow file `release.yml`
- `GH_TOKEN` or the built-in `github.token` permissions for GitHub Releases if your config targets GitHub

npm trusted publishing uses GitHub Actions OIDC and does not need `NPM_TOKEN`.
The plan job uses `mannyc2/ts-release-action@v1` and uploads review artifacts
before any release operation can execute. A raw CLI fallback lives at
`templates/github-actions-cli/trusted-publishing.yml`.
