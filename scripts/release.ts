import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Schema } from "effect"

// Repository distribution tooling. Preparation is read-only remotely; mutation
// commands require --execute and consume the retained archives without rebuilding.
export const owners = ["catalog", "github", "mcp", "npm", "openai", "pypi", "ts-release"] as const
export const repository = "mannyc2/ts-release"
export const registry = "https://registry.npmjs.org/"
const root = resolve(import.meta.dir, "..")
const sha256 = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u))
const version = Schema.String.check(Schema.isPattern(/^\d+\.\d+\.\d+$/u))
export class PackageArchive extends Schema.Class<PackageArchive>("Distribution.Package")({
  name: Schema.String,
  file: Schema.String,
  sha256,
  integrity: Schema.String,
}) {}
export class Distribution extends Schema.Class<Distribution>("Distribution")({
  format: Schema.Literal("ts-release/distribution/1"),
  version,
  commit: Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/u)),
  packages: Schema.Array(PackageArchive),
  actionSha256: sha256,
  actionMetadataSha256: sha256,
  notesSha256: sha256,
}) {}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const integrity = (bytes: Uint8Array) =>
  `sha512-${createHash("sha512").update(bytes).digest("base64")}`
export const packageName = (owner: string) =>
  `@mannyc1/${owner === "ts-release" ? owner : `ts-release-${owner}`}`

async function run(argv: string[], cwd = root): Promise<string> {
  const child = Bun.spawn(argv, { cwd, stdin: "inherit", stdout: "pipe", stderr: "pipe" })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(exit, 0, `${argv[0]} ${argv[1]} failed\n${stdout}\n${stderr}`)
  return stdout.trim()
}

export async function readDistribution(directory: string): Promise<Distribution> {
  const manifest = Schema.decodeUnknownSync(Distribution, { onExcessProperty: "error" })(
    JSON.parse(await readFile(join(directory, "release.json"), "utf8")),
  )
  assert.deepEqual(
    manifest.packages.map((entry) => entry.name),
    owners.map(packageName),
    "The complete ordered seven-package cohort is required",
  )
  for (const [index, entry] of manifest.packages.entries()) {
    assert.equal(
      entry.file,
      `${owners[index]}-${manifest.version}.tgz`,
      "Unexpected archive filename",
    )
    const bytes = await readFile(join(directory, entry.file))
    assert.equal(hash(bytes), entry.sha256, `${entry.name}: archive SHA-256 differs`)
    assert.equal(integrity(bytes), entry.integrity, `${entry.name}: archive integrity differs`)
    const pkg = JSON.parse(
      await run(["tar", "-xOf", join(directory, entry.file), "package/package.json"]),
    )
    assert.equal(pkg.name, entry.name)
    assert.equal(pkg.version, manifest.version)
    assert.equal(pkg.private, undefined)
    assert.equal(
      pkg.repository?.url,
      `git+https://github.com/${repository}.git`,
      "npm provenance needs the exact repository",
    )
  }
  assert.equal(hash(await readFile(join(directory, "release-notes.md"))), manifest.notesSha256)
  return manifest
}

async function bindSource(manifest: Distribution) {
  assert.equal(
    await run(["git", "rev-parse", "HEAD"]),
    manifest.commit,
    "Checkout must match the retained candidate",
  )
  assert.equal(
    hash(await readFile(join(root, "apps/action/dist/launcher.cjs"))),
    manifest.actionSha256,
  )
  assert.equal(
    hash(await readFile(join(root, "apps/action/action.yml"))),
    manifest.actionMetadataSha256,
  )
}

async function prepare(directory: string) {
  assert.equal(
    await run(["git", "status", "--porcelain"]),
    "",
    "Commit the reviewed candidate before preparing distribution",
  )
  const workspace = JSON.parse(await readFile(join(root, "package.json"), "utf8"))
  Schema.decodeUnknownSync(version)(workspace.version)
  assert.equal(
    Bun.version,
    workspace.packageManager.replace("bun@", ""),
    "Use the pinned Bun version",
  )
  const commit = await run(["git", "rev-parse", "HEAD"])
  await run([process.execPath, "run", "build:delivery"])
  assert.equal(
    await run(["git", "status", "--porcelain"]),
    "",
    "Built Action must equal the committed launcher",
  )
  await mkdir(directory, { recursive: false }) // Never overwrite a retained candidate.
  const packages = []
  for (const owner of owners) {
    const cwd = join(root, "packages", owner)
    const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"))
    assert.equal(pkg.name, packageName(owner))
    assert.equal(pkg.version, workspace.version, "Package versions must be aligned")
    const file = `${owner}-${pkg.version}.tgz`
    await run(
      [process.execPath, "pm", "pack", "--ignore-scripts", "--filename", join(directory, file)],
      cwd,
    )
    const bytes = await readFile(join(directory, file))
    packages.push(
      new PackageArchive({
        name: pkg.name,
        file,
        sha256: hash(bytes),
        integrity: integrity(bytes),
      }),
    )
  }
  const migration = `https://github.com/${repository}/blob/${commit}/docs/migration-0.4.md`
  const notes =
    `# ts-release ${workspace.version}\n\nThis release replaces the configuration-driven CLI with authored release applications.\n\n` +
    `Read the [migration guide](${migration}) before upgrading existing automation. Complete unfinished releases with their original pinned runtime, application and retained state.\n\n` +
    `All seven npm packages are version ${workspace.version}. Install the core and the providers your application uses:\n\n` +
    `\x60\x60\x60sh\nbun add @mannyc1/ts-release@${workspace.version} @mannyc1/ts-release-npm@${workspace.version} @mannyc1/ts-release-github@${workspace.version} effect@${workspace.devDependencies.effect}\nbun run ts-release --observe ./release.mjs ./release-input.json\n\x60\x60\x60\n\n` +
    `Pin the tested Node 24 Action to the immutable source commit:\n\n\x60\x60\x60yaml\n- uses: ${repository}/apps/action@${commit}\n  with:\n    application: release.mjs\n    input: '{}' # Replace with your application input.\n    observe: 'true'\n\x60\x60\x60\n\n` +
    `The attached release.json records the exact package archives and Action digests.\n`
  await writeFile(join(directory, "release-notes.md"), notes, { flag: "wx" })
  const manifest = new Distribution({
    format: "ts-release/distribution/1",
    version: workspace.version,
    commit,
    packages,
    actionSha256: hash(await readFile(join(root, "apps/action/dist/launcher.cjs"))),
    actionMetadataSha256: hash(await readFile(join(root, "apps/action/action.yml"))),
    notesSha256: hash(Buffer.from(notes)),
  })
  await writeFile(
    join(directory, "release.json"),
    JSON.stringify(Schema.encodeSync(Distribution)(manifest), null, 2) + "\n",
    { flag: "wx" },
  )
  await readDistribution(directory)
  console.log(JSON.stringify({ status: "prepared", directory, version: manifest.version, commit }))
}

export type RegistryVersion = { name: string; version: string; dist: { integrity: string } }
export async function observePackage(
  name: string,
  selectedVersion: string,
): Promise<RegistryVersion | null> {
  const response = await fetch(`${registry}${encodeURIComponent(name)}/${selectedVersion}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (response.status === 404) return null
  assert.equal(response.status, 200, `Registry observation failed for ${name}: ${response.status}`)
  return (await response.json()) as RegistryVersion
}
export function assertEquivalent(
  entry: PackageArchive,
  selectedVersion: string,
  observed: RegistryVersion,
) {
  assert.equal(observed.name, entry.name)
  assert.equal(observed.version, selectedVersion)
  assert.equal(
    observed.dist?.integrity,
    entry.integrity,
    `${entry.name}: published bytes conflict with the retained archive`,
  )
}
const waitForRegistry = (milliseconds: number) => Bun.sleep(milliseconds)

async function waitForPublishedPackage(
  entry: PackageArchive,
  version: string,
  selector: string,
  observe: typeof observePackage,
  wait: typeof waitForRegistry,
) {
  // npm can accept an upload before either the version or latest is visible.
  // Only observations repeat; an upload is never retried by this loop.
  for (let attempt = 0; attempt < 31; attempt++) {
    const observed = await observe(entry.name, selector)
    if (observed) {
      assert.equal(observed.name, entry.name)
      if (selector !== "latest" || observed.version === version) {
        assertEquivalent(entry, version, observed)
        return
      }
    }
    if (attempt < 30) await wait(10_000)
  }
  assert.fail(
    `${entry.name}: ${selector === "latest" ? "latest is unconfirmed" : "publication is unconfirmed"}; retain these archives and inspect the registry`,
  )
}

export async function verifyRegistry(
  manifest: Distribution,
  observe: typeof observePackage = observePackage,
  wait: typeof waitForRegistry = waitForRegistry,
) {
  for (const entry of manifest.packages) {
    await waitForPublishedPackage(entry, manifest.version, manifest.version, observe, wait)
    await waitForPublishedPackage(entry, manifest.version, "latest", observe, wait)
  }
}

export async function publishCohort(
  manifest: Distribution,
  observe: typeof observePackage,
  send: (entry: PackageArchive) => Promise<void>,
  wait: typeof waitForRegistry = waitForRegistry,
) {
  // Preflight the entire cohort before any write, so a known conflict stops all publication.
  for (const entry of manifest.packages) {
    const observed = await observe(entry.name, manifest.version)
    if (observed) assertEquivalent(entry, manifest.version, observed)
  }
  for (const entry of manifest.packages) {
    const observed = await observe(entry.name, manifest.version)
    if (observed) {
      assertEquivalent(entry, manifest.version, observed)
      console.log(`${entry.name}@${manifest.version}: exact archive already published`)
      continue
    }
    // Providers go first; the core's latest tag advances only after all six exist.
    // npm versions are immutable. A failed command stops; reruns first compare
    // registry integrity and never replace an existing version or blindly loop.
    await send(entry)
    await waitForPublishedPackage(entry, manifest.version, manifest.version, observe, wait)
    console.log(`${entry.name}@${manifest.version}: publication verified`)
  }
}

async function publish(directory: string, manifest: Distribution, provenance: boolean) {
  assert.equal(await run(["npm", "--version"]), "11.11.0", "Use the pinned npm publisher")
  await publishCohort(manifest, observePackage, async (entry) => {
    const child = Bun.spawn(
      [
        "npm",
        "publish",
        join(directory, entry.file),
        "--access",
        "public",
        "--tag",
        "latest",
        "--ignore-scripts",
        `--provenance=${provenance}`,
        "--registry",
        registry,
      ],
      { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
    )
    assert.equal(
      await child.exited,
      0,
      `${entry.name}: npm publication failed; inspect the registry before continuing`,
    )
  })
  await verifyRegistry(manifest)
}

type GithubRelease = {
  id: number
  tag_name: string
  draft: boolean
  target_commitish: string
  body: string
  assets: Array<{ name: string; digest: string | null }>
}

export async function prepareGithubRelease(
  directory: string,
  manifest: Distribution,
  execute: typeof run = run,
): Promise<GithubRelease> {
  const tag = `v${manifest.version}`
  // The tag endpoint can return 404 for a draft. Authenticated listing finds
  // both a newly created draft and one retained after an interrupted upload.
  const findRelease = async () => {
    const releases: GithubRelease[] = JSON.parse(
      await execute(["gh", "api", `repos/${repository}/releases?per_page=100`]),
    )
    return releases.find((entry) => entry.tag_name === tag)
  }
  let release = await findRelease()
  if (!release) {
    await execute([
      "gh",
      "release",
      "create",
      tag,
      "--repo",
      repository,
      "--target",
      manifest.commit,
      "--title",
      `ts-release ${manifest.version}`,
      "--notes-file",
      join(directory, "release-notes.md"),
      "--draft",
    ])
    release = await findRelease()
  }
  assert.ok(release, "Created release is not visible; retain these archives and inspect GitHub")
  if (release.draft) assert.equal(release.target_commitish, manifest.commit, "Draft target differs")
  assert.equal(
    release.body.trimEnd(),
    (await readFile(join(directory, "release-notes.md"), "utf8")).trimEnd(),
    "Existing release notes differ",
  )
  return release
}

async function publishGithub(directory: string, manifest: Distribution) {
  await verifyRegistry(manifest)
  const tag = `v${manifest.version}`
  const response = await fetch(`https://api.github.com/repos/${repository}/git/ref/tags/${tag}`)
  if (response.ok) {
    const commit = JSON.parse(await run(["gh", "api", `repos/${repository}/commits/${tag}`]))
    assert.equal(commit.sha, manifest.commit, "Existing release tag points to a different commit")
  } else assert.equal(response.status, 404, "Could not inspect release tag")
  const release = await prepareGithubRelease(directory, manifest)
  const files = [
    "release.json",
    "release-notes.md",
    ...manifest.packages.map((entry) => entry.file),
  ]
  for (const file of files) {
    const asset = release.assets.find((entry: { name: string }) => entry.name === file)
    if (asset)
      assert.equal(
        asset.digest,
        `sha256:${hash(await readFile(join(directory, file)))}`,
        `Existing release asset differs: ${file}`,
      )
    else await run(["gh", "release", "upload", tag, join(directory, file), "--repo", repository])
  }
  const retained = JSON.parse(
    await run(["gh", "api", `repos/${repository}/releases/${release.id}`]),
  )
  for (const file of files) {
    const asset = retained.assets.find((entry: { name: string }) => entry.name === file)
    assert.equal(
      asset?.digest,
      `sha256:${hash(await readFile(join(directory, file)))}`,
      `Release asset verification failed: ${file}`,
    )
  }
  if (release.draft)
    await run(["gh", "release", "edit", tag, "--draft=false", "--latest", "--repo", repository])
  const publishedCommit = JSON.parse(await run(["gh", "api", `repos/${repository}/commits/${tag}`]))
  assert.equal(publishedCommit.sha, manifest.commit)
  console.log(`https://github.com/${repository}/releases/tag/${tag}`)
}

if (import.meta.main) {
  const [command, suppliedDirectory, approval] = process.argv.slice(2)
  assert.ok(
    ["prepare", "check", "publish", "publish-local", "verify-registry", "github"].includes(
      command ?? "",
    ),
    "Usage: bun scripts/release.ts <prepare|check|publish|publish-local|verify-registry|github> <directory> [--execute]",
  )
  assert.ok(suppliedDirectory, "Choose an explicit distribution directory")
  assert.ok(process.argv.length <= 5)
  const directory = resolve(suppliedDirectory)
  if (command === "prepare") await prepare(directory)
  else {
    if (command === "publish" || command === "publish-local" || command === "github")
      assert.equal(approval, "--execute", "Publication requires explicit --execute approval")
    const manifest = await readDistribution(directory)
    await bindSource(manifest)
    if (command === "publish" || command === "publish-local")
      await publish(directory, manifest, command === "publish")
    else if (command === "github") await publishGithub(directory, manifest)
    else if (command === "verify-registry") await verifyRegistry(manifest)
    else
      console.log(
        JSON.stringify({
          status: "verified",
          version: manifest.version,
          packages: manifest.packages.length,
          action: `${repository}/apps/action@${manifest.commit}`,
        }),
      )
  }
}
