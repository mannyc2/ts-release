import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as Archive from "effect-build-archives"
import { adoptFile } from "@mannyc1/ts-release/effect-build"
import { encodeBundle, finalize, loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner } from "@mannyc1/ts-release/node"

const work = await mkdtemp("/tmp/ts-release-producer-archives-")
const producer = join(work, "producer"),
  delivery = join(work, "delivery")
await mkdir(producer)
await mkdir(delivery)
const owner = fileContentOwner(join(work, "owned")),
  records = [],
  checks = []
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name)
  checks.push(name)
}
const native = (tool, args, cwd = work) =>
  execFileSync(tool, args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      LC_ALL: "C",
      TZ: "UTC",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
    },
  })
const run = (effect) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Archive.layer({ executable: "/usr/bin/git" })),
      Effect.provide(NodeServices.layer),
    ),
  )
const producedBy = { name: "ts-release/native-archive-fixture", version: "fixture" }
const finalized = async (name, content) => {
  await writeFile(join(producer, name), content)
  return run(Artifact.file(join(producer, name), producedBy))
}
const executable = await finalized(
  "cli",
  "#!/bin/sh\nprintf 'ts-release archive fixture 1.0.0\\n'\n",
)
const readme = await finalized("README.md", "owned archive fixture\n")
const entries = [
  { artifact: readme, path: "share/README.md" },
  { artifact: executable, path: "bin/ts-release-fixture", executable: true },
]
const archive = { zip: Archive.zip, "tar.gz": Archive.tarGz }
for (const format of ["zip", "tar.gz"]) {
  const outputs = []
  for (const repeat of [0, 1])
    outputs.push(
      await run(
        archive[format]({
          entries: repeat ? [...entries].reverse() : entries,
          outfile: join(producer, `binary-${repeat}.${format}`),
        }),
      ),
    )
  check(`${format} normalized input order repeat digest`, outputs[0].sha256, outputs[1].sha256)
  const file = await run(adoptFile(owner, `binary.${format}`, outputs[0]))
  records.push({ kind: "binary", format, native: outputs[0], file })
  for (const [label, paths] of [
    ["traversal", ["../escape", "safe"]],
    ["duplicate", ["same", "same"]],
    ["case", ["Readme", "README"]],
  ]) {
    const outfile = join(producer, `rejected-${label}.${format}`)
    await assert.rejects(
      run(archive[format]({ outfile, entries: paths.map((path) => ({ artifact: readme, path })) })),
      { _tag: "InputInvalid" },
    )
    await assert.rejects(stat(outfile), { code: "ENOENT" })
    checks.push(`${format} ${label} typed rejection and no publication`)
  }
}
const repository = join(producer, "repository")
for (const directory of ["bin", "dist", "vendor", `pax-${"é".repeat(52)}`])
  await mkdir(join(repository, directory), { recursive: true })
const git = (args) => native("/usr/bin/git", args, repository).trim()
git(["init", "--initial-branch=main"])
git(["config", "user.name", "ts-release acceptance"])
git(["config", "user.email", "acceptance@example.test"])
await writeFile(join(repository, ".gitattributes"), "secret.txt export-ignore\n")
await writeFile(join(repository, "secret.txt"), "must not escape exact projection\n")
await writeFile(join(repository, "dist/output"), "tracked build output\n")
await writeFile(join(repository, "README.md"), "exact Git tree\n")
await writeFile(
  join(repository, "asset.lfs"),
  `version https://git-lfs.github.com/spec/v1\noid sha256:${"a".repeat(64)}\nsize 17\n`,
)
await writeFile(join(repository, "bin/cli"), "#!/bin/sh\nprintf 'source archive 1.0.0\\n'\n")
await chmod(join(repository, "bin/cli"), 0o755)
await symlink("README.md", join(repository, "README.link"))
const paxPath = `pax-${"é".repeat(52)}/payload.txt`
await writeFile(join(repository, paxPath), "PAX bytes\n")
await symlink(paxPath, join(repository, "pax.link"))
await writeFile(join(repository, "trailing-name "), "trailing bytes\n")
await symlink("trailing-name ", join(repository, "trailing.link"))
git(["add", "."])
git(["commit", "-qm", "exact source fixture"])
git([
  "update-index",
  "--add",
  "--cacheinfo",
  `160000,${git(["rev-parse", "HEAD"])},vendor/submodule`,
])
git(["commit", "-qm", "retain submodule boundary"])
const tree = git(["rev-parse", "HEAD^{tree}"])
for (const format of ["zip", "tar.gz"]) {
  const outputs = []
  for (const repeat of [0, 1])
    outputs.push(
      await run(
        Archive.source({
          repository,
          tree,
          project: "fixture",
          version: "1.0.0",
          format,
          // Tracked build output stays out of the source archive by explicit declaration.
          excludes: ["dist"],
          outfile: join(producer, `source-${repeat}.${format}`),
        }),
      ),
    )
  check(`${format} exact tree repeat digest`, outputs[0].sha256, outputs[1].sha256)
  records.push({
    kind: "source",
    format,
    tree,
    native: outputs[0],
    file: await run(adoptFile(owner, `source.${format}`, outputs[0])),
  })
}
const bundle = await run(finalize(records.map((row) => row.file)))
await writeFile(join(work, "bundle.json"), encodeBundle(bundle))
await rm(producer, { recursive: true })
const reopened = fileContentOwner(join(work, "owned"))
check(
  "Bundle reload after all producer and Git source deletion",
  (await run(loadBundle(reopened, await readFile(join(work, "bundle.json"))))).artifacts,
  bundle.artifacts,
)
for (const row of records) {
  const archive = join(delivery, row.file.logicalName),
    extracted = join(delivery, row.file.logicalName + "-extracted")
  await writeFile(archive, await run(reopened.read(row.file.content)))
  await mkdir(extracted)
  const zip = row.format === "zip"
  const names = native(
    zip ? "/usr/bin/unzip" : "/usr/bin/tar",
    zip ? ["-Z1", archive] : ["--quoting-style=literal", "-tzf", archive],
  )
    .trimEnd()
    .split("\n")
  const details = native(
    zip ? "/usr/bin/zipinfo" : "/usr/bin/tar",
    zip ? ["-l", archive] : ["--quoting-style=literal", "-tvzf", archive],
  )
  if (row.kind === "binary") {
    check(`${row.format} exact binary member list`, names, [
      "bin/ts-release-fixture",
      "share/README.md",
    ])
    check(
      `${row.format} executable mode`,
      /-rwxr-xr-x[^\n]*bin\/ts-release-fixture/u.test(details),
      true,
    )
    check(`${row.format} file mode`, /-rw-r--r--[^\n]*share\/README.md/u.test(details), true)
    check(
      `${row.format} normalized epoch`,
      details.includes(zip ? "80-Jan-01 00:00" : "1970-01-01 00:00"),
      true,
    )
    if (!zip)
      check(
        "tar normalized uid/gid",
        details
          .split("\n")
          .filter(Boolean)
          .every((line) => line.includes("0/0")),
        true,
      )
  } else {
    const expected = [
      "",
      ".gitattributes",
      "README.link",
      "README.md",
      "asset.lfs",
      "bin",
      "bin/cli",
      `pax-${"é".repeat(52)}`,
      paxPath,
      "pax.link",
      "trailing-name ",
      "trailing.link",
      "vendor",
    ]
      .map((name) => `fixture-1.0.0${name ? "/" + name : ""}`)
      .sort()
    check(
      `${row.format} exact projected source members`,
      names.map((name) => name.replace(/\/$/u, "")).sort(),
      expected,
    )
    check(`${row.format} source executable mode`, /-rwxr-xr-x[^\n]*bin\/cli/u.test(details), true)
    check(`${row.format} source symlink mode`, /lrwxrwxrwx[^\n]*README.link/u.test(details), true)
  }
  native(
    zip ? "/usr/bin/unzip" : "/usr/bin/tar",
    zip ? ["-q", archive, "-d", extracted] : ["-xzf", archive, "-C", extracted],
  )
  if (row.kind === "binary")
    check(
      `${row.format} extracted native CLI`,
      native(join(extracted, "bin/ts-release-fixture"), []),
      "ts-release archive fixture 1.0.0\n",
    )
  else {
    const project = join(extracted, "fixture-1.0.0")
    check(
      `${row.format} extracted native source CLI`,
      native(join(project, "bin/cli"), []),
      "source archive 1.0.0\n",
    )
    check(
      `${row.format} exact source symlink`,
      await readlink(join(project, "README.link")),
      "README.md",
    )
    check(
      `${row.format} LFS remains pointer bytes`,
      await readFile(join(project, "asset.lfs"), "utf8"),
      `version https://git-lfs.github.com/spec/v1\noid sha256:${"a".repeat(64)}\nsize 17\n`,
    )
    check(
      `${row.format} PAX path bytes`,
      await readFile(join(project, paxPath), "utf8"),
      "PAX bytes\n",
    )
    check(`${row.format} PAX symlink target`, await readlink(join(project, "pax.link")), paxPath)
    check(
      `${row.format} trailing-space path`,
      await readFile(join(project, "trailing-name "), "utf8"),
      "trailing bytes\n",
    )
    check(
      `${row.format} trailing-space link`,
      await readlink(join(project, "trailing.link")),
      "trailing-name ",
    )
  }
}
await writeFile(
  join(work, "evidence.json"),
  JSON.stringify(
    {
      format: "ts-release/native-producer-archives/2",
      work,
      runtime: process.version,
      bun: process.versions.bun ?? null,
      checks,
      records,
      producerDeleted: true,
      limits: ["Local native source consumer; fresh packed acceptance remains separate."],
    },
    null,
    2,
  ) + "\n",
)
console.log(JSON.stringify({ work, checks: checks.length, artifacts: records.length }))
