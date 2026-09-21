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
  prepareGithubRelease,
  publishCohort,
  readDistribution,
  verifyRegistry,
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
    let waits = 0
    await expect(
      publishCohort(
        distribution,
        async () => null,
        async () => {
          sends++
        },
        async () => {
          waits++
        },
      ),
    ).rejects.toThrow("publication is unconfirmed")
    expect(sends).toBe(1)
    expect(waits).toBeGreaterThan(0)
  })
  test("waits for accepted uploads to become visible without sending them again", async () => {
    const pending = new Map<string, number>()
    const sends: string[] = []
    let waits = 0
    await publishCohort(
      distribution,
      async (name) => {
        const remaining = pending.get(name)
        if (remaining === undefined) return null
        if (remaining > 0) {
          pending.set(name, remaining - 1)
          return null
        }
        return observed(distribution.packages.find((entry) => entry.name === name)!)
      },
      async (entry) => {
        sends.push(entry.name)
        pending.set(entry.name, 2)
      },
      async () => {
        waits++
      },
    )
    expect(sends).toEqual(owners.map(packageName))
    expect(waits).toBe(14)
  })
  test("stops immediately on conflicting bytes after an accepted upload", async () => {
    const sends: string[] = []
    let waits = 0
    await expect(
      publishCohort(
        distribution,
        async (name) =>
          sends.includes(name)
            ? { name, version: "0.4.0", dist: { integrity: "different" } }
            : null,
        async (entry) => {
          sends.push(entry.name)
        },
        async () => {
          waits++
        },
      ),
    ).rejects.toThrow("published bytes conflict")
    expect(sends).toHaveLength(1)
    expect(waits).toBe(0)
  })
  test("waits for latest to catch up to the already visible version", async () => {
    const stale = new Set(distribution.packages.map((entry) => entry.name))
    let waits = 0
    await verifyRegistry(
      distribution,
      async (name, selector) => {
        const entry = distribution.packages.find((entry) => entry.name === name)!
        if (selector === "latest" && stale.delete(name))
          return { name, version: "0.3.1", dist: { integrity: "old" } }
        return observed(entry)
      },
      async () => {
        waits++
      },
    )
    expect(waits).toBe(7)
  })
  test("does not accept a latest tag that never reaches the retained version", async () => {
    await expect(
      verifyRegistry(
        distribution,
        async (name, selector) =>
          selector === "latest"
            ? { name, version: "0.3.1", dist: { integrity: "old" } }
            : observed(distribution.packages.find((entry) => entry.name === name)!),
        async () => {},
      ),
    ).rejects.toThrow("latest is unconfirmed")
  })
})

describe("GitHub release preparation", () => {
  const draft = () => ({
    id: 123,
    tag_name: "v0.4.0",
    draft: true,
    target_commitish: distribution.commit,
    body: "release notes\n",
    assets: [],
  })
  test("finds a newly created draft even when lookup by tag would return 404", async () => {
    let created = false
    let creates = 0
    const release = await prepareGithubRelease(work, distribution, async (argv) => {
      if (argv[1] === "api") {
        if (argv[2] !== "repos/mannyc2/ts-release/releases?per_page=100")
          throw new Error("Not Found (HTTP 404)")
        return JSON.stringify(created ? [draft()] : [])
      }
      expect(argv.slice(0, 4)).toEqual(["gh", "release", "create", "v0.4.0"])
      expect(argv).toContain("--draft")
      expect(argv).toContain(distribution.commit)
      created = true
      creates++
      return "https://github.com/mannyc2/ts-release/releases/tag/untagged-example"
    })
    expect(release.id).toBe(123)
    expect(creates).toBe(1)
  })
  test("resumes an existing draft without creating another release", async () => {
    const release = await prepareGithubRelease(work, distribution, async (argv) => {
      expect(argv[1]).toBe("api")
      return JSON.stringify([draft()])
    })
    expect(release.id).toBe(123)
  })
  test("rejects a retained draft for another commit", async () => {
    await expect(
      prepareGithubRelease(work, distribution, async () =>
        JSON.stringify([{ ...draft(), target_commitish: "f".repeat(40) }]),
      ),
    ).rejects.toThrow("Draft target differs")
  })
})
