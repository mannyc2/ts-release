> Historical pre-0.4 configuration example. The current CLI runs an authored
> application; see the repository README and `docs/preparation.md`. Commands and
> configuration APIs below are not supported by the current implementation.

# npm token-mode template

This template is the explicit non-OIDC migration path. The authored config
contains only the environment-variable name `NPM_TOKEN`; the token value stays
inside the host credential boundary and is written only to the scoped,
temporary npm user config during an authorized publish.

For GitHub-hosted Actions, prefer `../npm-github/release.config.json` and its
explicit trusted-publisher attestation. Do not combine the token and trusted
authentication shapes.
