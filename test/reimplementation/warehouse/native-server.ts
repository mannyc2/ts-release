import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createServer } from "node:net"
import * as PyPi from "@mannyc1/ts-release-pypi"

export const pythonBin =
  process.env.TS_RELEASE_PYTHON_NATIVE_BIN ?? "/tmp/ts-release-warehouse-native-venv/bin"
export const command = async (argv: string[], env: NodeJS.ProcessEnv = process.env) => {
  const child = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", env })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`${argv[0]} exited ${code}: ${stdout}\n${stderr}`)
  return stdout
}
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const socket = createServer()
    socket.on("error", reject)
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address()
      if (typeof address !== "object" || address === null) throw new Error("Missing address")
      socket.close(() => resolve(address.port))
    })
  })
export const nativeServer = async (implementation: "pypiserver" | "devpi-server", count: 2 | 4) => {
  const root = await mkdtemp(join(tmpdir(), `ts-release-${implementation}-${count}-`))
  const versions = JSON.parse(
    await command([
      join(pythonBin, "python"),
      "-c",
      "import importlib.metadata,json; print(json.dumps({n:importlib.metadata.version(n) for n in ['pypiserver','devpi-server','pip']}))",
    ]),
  )
  if (versions.pypiserver !== "2.4.1" || versions["devpi-server"] !== "6.20.3")
    throw new Error("Native server version drift")
  await command([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-sha256",
    "-days",
    "1",
    "-keyout",
    join(root, "key.pem"),
    "-out",
    join(root, "cert.pem"),
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ])
  const upstream = `http://127.0.0.1:${await freePort()}`
  const uploads: { filename: string; status: number; bytes: number }[] = []
  let hidden = false
  const gateway = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    tls: {
      key: await readFile(join(root, "key.pem")),
      cert: await readFile(join(root, "cert.pem")),
    },
    async fetch(request) {
      const url = new URL(request.url)
      if (
        hidden &&
        request.method === "GET" &&
        (url.pathname.includes("/simple/") || url.pathname.includes("/+simple/"))
      )
        return new Response(null, { status: 404 })
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : new Uint8Array(await request.arrayBuffer())
      const headers = new Headers(request.headers)
      headers.delete("host")
      const native = await fetch(`${upstream}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        ...(body === undefined ? {} : { body }),
        redirect: "manual",
      })
      const bytes = new Uint8Array(await native.arrayBuffer())
      if (
        request.method === "POST" &&
        request.headers.get("content-type")?.startsWith("multipart/")
      ) {
        const form = await new Response(body, { headers: request.headers }).formData()
        const file = form.get("content") as File
        uploads.push({ filename: file.name, status: native.status, bytes: file.size })
      }
      const outgoing = new Headers(native.headers)
      outgoing.delete("content-length")
      return new Response(bytes, { status: native.status, headers: outgoing })
    },
  })
  let child: ReturnType<typeof Bun.spawn> | undefined
  const close = async () => {
    gateway.stop(true)
    if (child) {
      child.kill()
      await child.exited
    }
  }
  try {
    const port = new URL(upstream).port,
      nativeRoot = join(root, "server")
    await mkdir(nativeRoot)
    const log = Bun.file(join(root, "native-server.log"))
    if (implementation === "devpi-server")
      await command([
        join(pythonBin, "devpi-init"),
        "--serverdir",
        nativeRoot,
        "--no-root-pypi",
        "--root-passwd",
        "fixture-password",
      ])
    child = Bun.spawn(
      implementation === "pypiserver"
        ? [
            join(pythonBin, "pypi-server"),
            "run",
            "-i",
            "127.0.0.1",
            "-p",
            port,
            "-a",
            ".",
            "-P",
            ".",
            "--disable-fallback",
            "--hash-algo",
            "sha256",
            nativeRoot,
          ]
        : [
            join(pythonBin, "devpi-server"),
            "--host",
            "127.0.0.1",
            "--port",
            port,
            "--serverdir",
            nativeRoot,
            "--outside-url",
            gateway.url.origin,
            "--offline-mode",
          ],
      { stdout: log, stderr: log },
    )
    let ready = false
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(upstream)
        await r.arrayBuffer()
        ready = true
        break
      } catch {
        await Bun.sleep(50)
      }
    }
    if (!ready) throw new Error("Native server did not start")
    if (implementation === "devpi-server") {
      const created = await fetch(`${upstream}/root/release`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${Buffer.from("root:fixture-password").toString("base64")}`,
        },
        body: JSON.stringify({ type: "stage", volatile: false, bases: [] }),
      })
      if (created.status !== 200)
        throw new Error(`Devpi index setup: ${created.status} ${await created.text()}`)
    }
    const endpoint = new PyPi.Compatible({
      implementation,
      version: versions[implementation],
      uploadUrl: `${gateway.url.origin}${implementation === "pypiserver" ? "/" : "/root/release/"}`,
      simpleUrl: `${gateway.url.origin}${implementation === "pypiserver" ? "/simple/" : "/root/release/+simple/"}`,
      duplicateLaw: "not-inherited",
    })
    const build = await Bun.file(join(import.meta.dir, "fixtures/build.json")).json()
    const filenames = build.files
      .map((row: { filename: string }) => row.filename)
      .filter((name: string) => count === 4 || /(?:py3-none-any\.whl|\.tar\.gz)$/u.test(name))
    await writeFile(
      join(root, "worker.json"),
      JSON.stringify({
        endpoint,
        filenames,
        username: implementation === "pypiserver" ? "fixture" : "root",
        password: "fixture-password",
      }),
    )
    return {
      root,
      endpoint,
      versions,
      filenames,
      uploads,
      hide: (value: boolean) => {
        hidden = value
      },
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
