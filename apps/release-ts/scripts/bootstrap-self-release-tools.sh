#!/usr/bin/env bash
set -euo pipefail
umask 077

NODE_SHA256=88fd1ce767091fd8d4a99fdb2356e98c819f93f3b1f8663853a2dee9b438068a
BUN_SHA256=951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f
NPM_SHA256=cbcf4cc03148ccdb586a8bf2093c952f093fb43d5cbc97593c98b67ef8c003b0
DISPATCH_SHA256=ec5d3be50d9df329c38887c99079aae70ff1f04f3f481296f60b6cf01cfa737f
NPM_OIDC_CERTIFIER_SHA256=4722f7a034868cfd14bc8125f49a92eadfe25c71656ec5f508a097aae40da475
TAG_SHA256=c22798cbdc8b5adaf0fec9e2526ee099e24fa1167ad011f780fa986480aad1b3
NPM_VERIFIER_SHA256=0947b060bc7555ac09b7c4d1517a34f533d2c0bf27732fcf00b6b2fb9ac3f28b

candidate_sha="${1:-}"
[[ "$candidate_sha" =~ ^[a-f0-9]{40}$ ]] || {
  echo "::error title=Invalid self-release candidate::candidate_sha must be one lowercase 40-hex commit."
  exit 1
}
[[ "${GITHUB_REPOSITORY:-}" == mannyc2/ts-release && "${GITHUB_REF:-}" == refs/heads/main ]]
[[ -n "${GITHUB_ENV:-}" && -n "${GITHUB_PATH:-}" && -n "${GITHUB_WORKSPACE:-}" && -n "${RUNNER_TEMP:-}" ]]

while IFS='=' read -r name _; do
  normalized="$(printf '%s' "$name" | /usr/bin/tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    npm_token|npm_id_token|node_auth_token|npm_config_*|prefix|destdir|node_options|node_path|node_extra_ca_certs|node_tls_reject_unauthorized|node_use_env_proxy|ssl_cert_file|ssl_cert_dir|openssl_conf|http_proxy|https_proxy|all_proxy|no_proxy|curl_ca_bundle|bun_options|bun_config_*|ld_preload|ld_library_path|dyld_insert_libraries|dyld_library_path|dyld_framework_path|git_*)
      echo "::error title=Unsafe self-release host::$name must be absent."
      exit 1
      ;;
  esac
done < <(/usr/bin/env)

for npmrc in "$GITHUB_WORKSPACE/.npmrc" "${HOME:-/nonexistent}/.npmrc" /etc/npmrc /usr/local/etc/npmrc; do
  [[ ! -s "$npmrc" ]] || {
    echo "::error title=Unsafe npm configuration::$npmrc must be absent or empty."
    exit 1
  }
done

tool_root="$(/usr/bin/mktemp -d "$RUNNER_TEMP/ts-release-exact-tools.XXXXXX")"
node_root="$tool_root/node-v22.22.2-linux-x64"
bun_root="$tool_root/bun-v1.3.14-linux-x64"
release_bin="$tool_root/bin"
release_home="$tool_root/empty-home"
/bin/mkdir -p "$node_root" "$bun_root" "$release_bin" "$release_home"
/bin/chmod 0700 "$tool_root" "$release_home"
/usr/bin/install -m 0600 /dev/null "$release_home/npm-userconfig"
/usr/bin/install -m 0600 /dev/null "$release_home/npm-globalconfig"

[[ -z "$(/usr/bin/find "$GITHUB_WORKSPACE" -mindepth 1 -maxdepth 1 -print -quit)" ]] || {
  echo "::error title=Unsafe self-release workspace::credentialed bootstrap requires one empty hosted workspace."
  exit 1
}

git_exact() {
  /usr/bin/env -i \
    HOME="$release_home" \
    LANG=C.UTF-8 \
    PATH=/usr/bin:/bin \
    GIT_CONFIG_GLOBAL=/dev/null \
    GIT_CONFIG_NOSYSTEM=1 \
    GIT_TERMINAL_PROMPT=0 \
    /usr/bin/git "$@"
}

canonical_origin=https://github.com/mannyc2/ts-release.git
git_exact -c init.defaultBranch=main init --quiet "$GITHUB_WORKSPACE"
git_exact -C "$GITHUB_WORKSPACE" remote add origin "$canonical_origin"
remote_line="$(git_exact -C "$GITHUB_WORKSPACE" ls-remote --refs origin refs/heads/main)"
[[ "$remote_line" == "$candidate_sha"$'\t'refs/heads/main ]] || {
  echo "::error title=Stale self-release candidate::origin/main is not the authorized candidate."
  exit 1
}
git_exact -C "$GITHUB_WORKSPACE" fetch --quiet --no-tags --depth=1 origin refs/heads/main
[[ "$(git_exact -C "$GITHUB_WORKSPACE" rev-parse FETCH_HEAD)" == "$candidate_sha" ]]
git_exact -C "$GITHUB_WORKSPACE" checkout --quiet --detach FETCH_HEAD
[[ "$(git_exact -C "$GITHUB_WORKSPACE" rev-parse HEAD)" == "$candidate_sha" ]]
[[ "$(git_exact -C "$GITHUB_WORKSPACE" remote get-url origin)" == "$canonical_origin" ]]
[[ "$(git_exact -C "$GITHUB_WORKSPACE" status --porcelain=v1 --untracked-files=all)" == "" ]]
remote_line="$(git_exact -C "$GITHUB_WORKSPACE" ls-remote --refs origin refs/heads/main)"
[[ "$remote_line" == "$candidate_sha"$'\t'refs/heads/main ]]

release_root="$GITHUB_WORKSPACE/.release"
npm_root="$release_root/tools/npm-11.11.0"
bundle_root="$release_root/self-release-tools"
/bin/mkdir -p "$npm_root/bin" "$bundle_root"

[[ ! -s "$GITHUB_WORKSPACE/.npmrc" ]] || {
  echo "::error title=Unsafe npm configuration::the exact candidate contains an active project npmrc."
  exit 1
}

fetch_exact() {
  local url="$1" destination="$2" expected="$3"
  /usr/bin/curl --fail --silent --show-error --location --max-redirs 5 \
    --proto '=https' --proto-redir '=https' --tlsv1.2 --connect-timeout 15 --max-time 120 \
    --output "$destination" "$url"
  printf '%s  %s\n' "$expected" "$destination" | /usr/bin/sha256sum --check --status
}

node_archive="$tool_root/node.tar.xz"
bun_archive="$tool_root/bun.zip"
npm_archive="$npm_root/npm-11.11.0.tgz"
fetch_exact "https://nodejs.org/dist/v22.22.2/node-v22.22.2-linux-x64.tar.xz" "$node_archive" "$NODE_SHA256"
fetch_exact "https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64.zip" "$bun_archive" "$BUN_SHA256"
fetch_exact "https://registry.npmjs.org/npm/-/npm-11.11.0.tgz" "$npm_archive" "$NPM_SHA256"

/usr/bin/tar -xJf "$node_archive" -C "$node_root" --strip-components=1 --no-same-owner
/usr/bin/unzip -q "$bun_archive" -d "$bun_root"
/usr/bin/tar -xzf "$npm_archive" -C "$npm_root" --no-same-owner

node_bin="$(/usr/bin/readlink -f "$node_root/bin/node")"
bun_bin="$(/usr/bin/readlink -f "$bun_root/bun-linux-x64/bun")"
npm_cli="$npm_root/package/bin/npm-cli.js"
[[ -x "$node_bin" && -x "$bun_bin" && -f "$npm_cli" ]]
[[ "$($node_bin --version)" == v22.22.2 ]]
[[ "$($bun_bin --version)" == 1.3.14 ]]
"$node_bin" -e '
  const manifest = require(process.argv[1]);
  if (manifest.name !== "npm" || manifest.version !== "11.11.0" ||
      manifest.bin?.npm !== "bin/npm-cli.js" || manifest.bin?.npx !== "bin/npx-cli.js") process.exit(1)
' "$npm_root/package/package.json"
/bin/ln -s ../package/bin/npm-cli.js "$npm_root/bin/npm"
/bin/ln -s "$node_bin" "$release_bin/node"
/bin/ln -s "$bun_bin" "$release_bin/bun"
/bin/ln -s "$npm_root/bin/npm" "$release_bin/npm"
[[ "$(HOME="$release_home" \
  NPM_CONFIG_USERCONFIG="$release_home/npm-userconfig" \
  NPM_CONFIG_GLOBALCONFIG="$release_home/npm-globalconfig" \
  PATH="$release_bin:/usr/bin:/bin" \
  "$release_bin/npm" --version)" == 11.11.0 ]]

copy_exact() {
  local source="$1" destination="$2" expected="$3"
  [[ -f "$source" && ! -L "$source" ]]
  /bin/cp "$source" "$destination"
  printf '%s  %s\n' "$expected" "$destination" | /usr/bin/sha256sum --check --status
}

candidate_tools="$GITHUB_WORKSPACE/apps/release-ts/release-tools"
copy_exact "$candidate_tools/dispatch.js" "$bundle_root/dispatch.js" "$DISPATCH_SHA256"
copy_exact "$candidate_tools/npm-oidc-certifier.js" "$bundle_root/npm-oidc-certifier.js" "$NPM_OIDC_CERTIFIER_SHA256"
copy_exact "$candidate_tools/tag.js" "$bundle_root/tag.js" "$TAG_SHA256"
copy_exact "$candidate_tools/npm-verifier.js" "$bundle_root/npm-verifier.js" "$NPM_VERIFIER_SHA256"
/bin/chmod 0500 "$bundle_root/dispatch.js" "$bundle_root/npm-oidc-certifier.js" "$bundle_root/tag.js" "$bundle_root/npm-verifier.js"

{
  printf 'TS_RELEASE_NODE_BIN=%s\n' "$node_bin"
  printf 'TS_RELEASE_BUN_BIN=%s\n' "$bun_bin"
  printf 'TS_RELEASE_DISPATCH_BIN=%s\n' "$bundle_root/dispatch.js"
  printf 'TS_RELEASE_NPM_OIDC_CERTIFIER_BIN=%s\n' "$bundle_root/npm-oidc-certifier.js"
  printf 'TS_RELEASE_TAG_BIN=%s\n' "$bundle_root/tag.js"
  printf 'TS_RELEASE_NPM_VERIFIER_BIN=%s\n' "$bundle_root/npm-verifier.js"
  printf 'TS_RELEASE_HOME=%s\n' "$release_home"
} >> "$GITHUB_ENV"
printf '%s\n' "$release_bin" >> "$GITHUB_PATH"

printf '{"schemaVersion":"ts-release/native-bootstrap/v1","status":"ready","node":"22.22.2","bun":"1.3.14","npm":"11.11.0"}\n'
