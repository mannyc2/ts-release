import { describe, expect, test } from "bun:test"
import {
  admitSelfReleaseCoordinates,
  type SelfReleaseMode
} from "../apps/release-ts/scripts/check-self-release-dispatch.js"

const sha = "c".repeat(40)
const digest = "d".repeat(64)
const prepared =
  `prepared:gha:mannyc2/ts-release/runs/334/attempts/1/artifacts/ts-release-prepared-1-${digest}#sha256-${digest}`
const npmDigest = "a".repeat(64)
const npmPrepared =
  `prepared:gha:mannyc2/ts-release/runs/334/attempts/1/artifacts/ts-release-prepared-1-${npmDigest}#sha256-${npmDigest}`

const input = (
  mode: SelfReleaseMode,
  preparedRef = mode === "certify-npm-oidc" || mode === "publish-npm" || mode === "publish-github" ? prepared : "",
  npmPreparedRef = mode === "publish-github" ? npmPrepared : ""
) => ({
  mode,
  candidateSha: sha,
  preparedRef,
  npmPreparedRef,
  repository: "mannyc2/ts-release",
  ref: "refs/heads/main",
  workflowSha: sha,
  checkoutSha: sha,
  remoteMainSha: sha,
  remoteUrl: "https://github.com/mannyc2/ts-release.git",
  environment: {}
})

describe("self-release dispatch admission", () => {
  test("admits exactly five disjoint authorities and two refs only for final GitHub publication", () => {
    expect(admitSelfReleaseCoordinates(input("prepare-exact-sha"))).toEqual({
      mode: "prepare-exact-sha",
      candidateSha: sha
    })
    expect(admitSelfReleaseCoordinates(input("publish-github"))).toMatchObject({
      mode: "publish-github",
      preparedDigest: digest,
      npmPreparedDigest: npmDigest
    })
    expect(admitSelfReleaseCoordinates(input("publish-npm"))).toMatchObject({
      mode: "publish-npm",
      preparedDigest: digest
    })
    expect(admitSelfReleaseCoordinates(input("certify-npm-oidc"))).toMatchObject({
      mode: "certify-npm-oidc",
      preparedDigest: digest
    })
    expect(admitSelfReleaseCoordinates(input("create-tag"))).toEqual({
      mode: "create-tag",
      candidateSha: sha
    })
  })

  test("rejects every repository, ref, exact-main, checkout, or workflow mismatch", () => {
    for (const patch of [
      { repository: "fork/ts-release" },
      { ref: "refs/heads/release" },
      { workflowSha: "e".repeat(40) },
      { checkoutSha: "e".repeat(40) },
      { remoteMainSha: "e".repeat(40) },
      { remoteUrl: "git@github.com:mannyc2/ts-release.git" },
      { candidateSha: "short" }
    ]) {
      expect(() => admitSelfReleaseCoordinates({ ...input("publish-npm"), ...patch })).toThrow()
    }
  })

  test("rejects cross-mode, noncanonical, or foreign prepared references", () => {
    expect(() => admitSelfReleaseCoordinates(input("prepare-exact-sha", prepared))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("create-tag", prepared))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("create-tag", "", npmPrepared))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("publish-npm", ""))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("publish-npm", prepared, npmPrepared))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("publish-github", prepared, ""))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("publish-github", prepared, prepared))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("publish-npm", prepared.replace("mannyc2", "attacker")))).toThrow()
    expect(() => admitSelfReleaseCoordinates(input("publish-npm", prepared.replace(`#sha256-${digest}`, `#sha256-${"e".repeat(64)}`)))).toThrow()
    expect(() => admitSelfReleaseCoordinates({ ...input("publish-npm"), mode: "release" as SelfReleaseMode })).toThrow()
  })

  test("rejects ambient npm tokens and registry authentication before any repository process", () => {
    for (const name of [
      "NPM_TOKEN",
      "NPM_ID_TOKEN",
      "NODE_AUTH_TOKEN",
      "npm_config__authToken",
      "NPM_CONFIG_REGISTRY",
      "NpM_CoNfIg_//registry.npmjs.org/:_authToken",
      "NPM_CONFIG_PREFIX",
      "npm_config_globalconfig",
      "PREFIX",
      "DESTDIR",
      "NODE_OPTIONS",
      "Node_Path",
      "NODE_EXTRA_CA_CERTS",
      "NODE_TLS_REJECT_UNAUTHORIZED",
      "NODE_USE_ENV_PROXY",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR",
      "OPENSSL_CONF",
      "HTTP_PROXY",
      "https_proxy",
      "ALL_PROXY",
      "NO_PROXY",
      "BUN_OPTIONS",
      "Bun_Config_Preload",
      "LD_PRELOAD",
      "DYLD_INSERT_LIBRARIES",
      "GIT_CONFIG_COUNT",
      "GIT_SSH_COMMAND",
      "GIT_EXEC_PATH",
      "GIT_DIR",
      "GIT_WORK_TREE",
      "GIT_OBJECT_DIRECTORY",
      "GIT_ALTERNATE_OBJECT_DIRECTORIES"
    ] as const) {
      expect(() => admitSelfReleaseCoordinates({
        ...input("prepare-exact-sha"),
        environment: { [name]: "private" }
      })).toThrow(name)
    }
  })
})
