/**
 * Embedded so source, built JS, npm consumers, and standalone CLI bundles all
 * execute the same audited helper bytes through the pinned Bun runtime.
 */
export const makeNetworkIsolationHelperSource = (requiredLibrary = "libseccomp.so.2"): string => String.raw`import { dlopen, ptr } from "bun:ffi"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import { arch, release } from "node:os"

const fail = (reason) => {
  process.stderr.write("ts-release network isolation failed closed: " + reason + "\n")
  process.exit(125)
}
if (process.platform !== "linux" || !["x64", "arm64"].includes(process.arch)) {
  fail("unsupported host " + process.platform + "/" + process.arch)
}
const identityPath = process.env.TS_RELEASE_NETWORK_IDENTITY_FILE
const expectedHelperDigest = process.env.TS_RELEASE_NETWORK_HELPER_SHA256
const libraryName = process.env.TS_RELEASE_NETWORK_LIBRARY
if (!identityPath || !expectedHelperDigest || libraryName !== ${JSON.stringify(requiredLibrary)}) {
  fail("missing or invalid internal isolation parameters")
}
const helperDigest = createHash("sha256").update(readFileSync(process.argv[1])).digest("hex")
if (helperDigest !== expectedHelperDigest) fail("helper digest disagrees with parent")
const argv = process.argv.slice(2)
if (argv.length === 0) fail("missing command")
const deniedSyscalls = [
  "socket", "socketpair", "connect", "bind", "listen", "accept", "accept4",
  "sendto", "sendmsg", "sendmmsg", "recvfrom", "recvmsg", "recvmmsg",
  "io_uring_setup", "io_uring_enter", "io_uring_register", "pidfd_getfd"
]
let library
try {
  library = dlopen(libraryName, {
    seccomp_init: { args: ["u32"], returns: "ptr" },
    seccomp_rule_add: { args: ["ptr", "u32", "i32", "u32"], returns: "i32" },
    seccomp_load: { args: ["ptr"], returns: "i32" },
    seccomp_release: { args: ["ptr"], returns: "void" },
    seccomp_syscall_resolve_name: { args: ["ptr"], returns: "i32" }
  })
} catch (cause) {
  fail("libseccomp.so.2 unavailable: " + String(cause))
}
let libraryPath
try {
  const mapping = readFileSync("/proc/self/maps", "utf8").split("\n").find((line) => line.includes("libseccomp.so"))
  const candidate = mapping && mapping.trim().split(/\s+/).at(-1)
  if (!candidate || !candidate.startsWith("/")) fail("loaded libseccomp mapping is unavailable")
  libraryPath = realpathSync(candidate)
} catch (cause) {
  fail("cannot identify loaded libseccomp: " + String(cause))
}
const libraryDigest = createHash("sha256").update(readFileSync(libraryPath)).digest("hex")
const bunDigest = createHash("sha256").update(readFileSync(realpathSync(process.execPath))).digest("hex")
const context = library.symbols.seccomp_init(0x7fff0000)
if (context === null) fail("seccomp_init returned null")
try {
  for (const name of deniedSyscalls) {
    const bytes = new TextEncoder().encode(name + "\0")
    const syscall = library.symbols.seccomp_syscall_resolve_name(ptr(bytes))
    if (syscall < 0) fail("kernel/libseccomp cannot resolve " + name)
    const result = library.symbols.seccomp_rule_add(context, 0x00050001, syscall, 0)
    if (result !== 0) fail("seccomp_rule_add(" + name + ") returned " + result)
  }
  const loaded = library.symbols.seccomp_load(context)
  if (loaded !== 0) fail("seccomp_load returned " + loaded)
} finally {
  library.symbols.seccomp_release(context)
}
library.close()
const identity = {
  protocol: "ts-release-seccomp-network-deny/v1",
  helperSha256: helperDigest,
  librarySha256: libraryDigest,
  bunVersion: globalThis["Bun"].version,
  bunSha256: bunDigest,
  kernel: release(),
  architecture: arch(),
  deniedSyscalls
}
try {
  writeFileSync(identityPath, JSON.stringify(identity), { encoding: "utf8", flag: "wx", mode: 0o600 })
} catch (cause) {
  fail("cannot persist isolation identity: " + String(cause))
}
const childEnvironment = { ...process.env }
delete childEnvironment.TS_RELEASE_NETWORK_IDENTITY_FILE
delete childEnvironment.TS_RELEASE_NETWORK_HELPER_SHA256
delete childEnvironment.TS_RELEASE_NETWORK_LIBRARY
// The runtime spawn API preserves caller-provided non-stdio descriptors. Close only the
// descriptors explicitly inherited without FD_CLOEXEC; Bun's own internal
// descriptors remain untouched and are closed by exec.
let libc
try {
  libc = dlopen("libc.so.6", {
    fcntl: { args: ["i32", "i32"], returns: "i32" },
    close: { args: ["i32"], returns: "i32" }
  })
  for (const item of readdirSync("/proc/self/fd")) {
    const fd = Number(item)
    if (!Number.isSafeInteger(fd) || fd <= 2) continue
    const flags = libc.symbols.fcntl(fd, 1)
    if (flags >= 0 && (flags & 1) === 0) libc.symbols.close(fd)
  }
  libc.close()
} catch (cause) {
  fail("cannot close inherited non-stdio descriptors: " + String(cause))
}
let child
try {
  child = globalThis["Bun"].spawn(argv, {
    env: childEnvironment,
    stdio: ["ignore", "inherit", "inherit"]
  })
} catch (cause) {
  fail("isolated child spawn failed: " + String(cause))
}
process.exit(await child.exited)
`

export const networkIsolationHelperSource = makeNetworkIsolationHelperSource()
