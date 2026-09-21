import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Schema } from "effect"
import {
  Distribution,
  PackageArchive,
  owners,
  packageName,
  publishCohort,
  readDistribution,
  type RegistryVersion,
} from "../../../scripts/release.js"

const root = resolve(import.meta.dir, "../../..")
const hash = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex")
let work: string
let distribution: Distribution
beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "ts-release-distribution-test-"))
  const source = join(work, "package")
  await mkdir(source)
  const packages = []
  for (const owner of owners) {
    const name = packageName(owner),
      file = `${owner}-0.4.0.tgz`
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name,
        version: "0.4.0",
        repository: { url: "git+https://github.com/mannyc2/ts-release.git" },
      }),
    )
    const child = Bun.spawn(["tar", "-czf", join(work, file), "package"], {
      cwd: work,
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await child.exited).toBe(0)
    const bytes = await readFile(join(work, file))
    packages.push(
      new PackageArchive({
        name,
        file,
        sha256: hash(bytes),
        integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      }),
    )
  }
  await writeFile(join(work, "release-notes.md"), "release notes\n")
  distribution = new Distribution({
    format: "ts-release/distribution/1",
    version: "0.4.0",
    commit: "a".repeat(40),
    packages,
    actionSha256: "b".repeat(64),
    actionMetadataSha256: "c".repeat(64),
    notesSha256: hash("release notes\n"),
  })
  await writeFile(
    join(work, "release.json"),
    JSON.stringify(Schema.encodeSync(Distribution)(distribution)),
  )
})
afterAll(async () => {
  await rm(work, { recursive: true, force: true })
})

describe("retained distribution", () => {
  test("accepts the complete exact archive set", async () => {
    expect((await readDistribution(work)).packages).toHaveLength(7)
  })
  test("rejects tampered archives before publication", async () => {
    const copy = `${work}-tampered`
    try {
      await cp(work, copy, { recursive: true })
      await writeFile(join(copy, distribution.packages[0]!.file), "changed")
      await expect(readDistribution(copy)).rejects.toThrow("archive SHA-256 differs")
    } finally {
      await rm(copy, { recursive: true, force: true })
    }
  })
  test("rejects a partial or reordered cohort", async () => {
    const copy = `${work}-partial`
    try {
      await cp(work, copy, { recursive: true })
      await writeFile(
        join(copy, "release.json"),
        JSON.stringify({ ...distribution, packages: distribution.packages.slice(1) }),
      )
      await expect(readDistribution(copy)).rejects.toThrow("complete ordered seven-package cohort")
    } finally {
      await rm(copy, { recursive: true, force: true })
    }
  })
  test("requires explicit execution before reading files or accessing the network", async () => {
    for (const command of ["publish", "publish-local", "github"]) {
      const child = Bun.spawn(
        [process.execPath, "scripts/release.ts", command, "/does-not-exist"],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      )
      const stderr = new Response(child.stderr).text()
      expect(await child.exited).not.toBe(0)
      expect(await stderr).toContain("explicit --execute approval")
    }
  })
})

describe("cohort publication", () => {
  const observed = (entry: PackageArchive): RegistryVersion => ({
    name: entry.name,
    version: "0.4.0",
    dist: { integrity: entry.integrity },
  })
  test("preflights all versions before sending and rejects a conflict in the final package", async () => {
    const sends: string[] = []
    await expect(
      publishCohort(
        distribution,
        async (name) =>
          name === "@mannyc1/ts-release"
            ? { name, version: "0.4.0", dist: { integrity: "different" } }
            : null,
        async (entry) => {
          sends.push(entry.name)
        },
      ),
    ).rejects.toThrow("published bytes conflict")
    expect(sends).toEqual([])
  })
  test("stops on a failed upload and resumes without reuploading confirmed packages", async () => {
    const registry = new Map<string, RegistryVersion>()
    const sends: string[] = []
    const read = async (name: string) => registry.get(name) ?? null
    let fail = true
    const send = async (entry: PackageArchive) => {
      sends.push(entry.name)
      registry.set(entry.name, observed(entry))
      if (entry.name === distribution.packages[2]!.name && fail) throw new Error("response lost")
    }
    await expect(publishCohort(distribution, read, send)).rejects.toThrow("response lost")
    expect(sends).toHaveLength(3)
    fail = false
    await publishCohort(distribution, read, send)
    expect(sends).toEqual(owners.map(packageName))
    expect(sends.at(-1)).toBe("@mannyc1/ts-release")
    await publishCohort(distribution, read, send)
    expect(sends).toHaveLength(7)
  })
  test("does not claim completion when an upload is not observable", async () => {
    let sends = 0
    await expect(
      publishCohort(
        distribution,
        async () => null,
        async () => {
          sends++
        },
      ),
    ).rejects.toThrow("publication is unconfirmed")
    expect(sends).toBe(1)
  })
})
