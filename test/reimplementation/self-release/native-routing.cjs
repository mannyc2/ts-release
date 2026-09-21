// Test-process socket routing only. Provider URLs, TLS verification and the
// production HTTP transport are unchanged; no connection may leave this peer.
const net = require("node:net")
const tls = require("node:tls")
const dns = require("node:dns")
const { syncBuiltinESMExports } = require("node:module")

const port = Number(process.env.TS_RELEASE_NATIVE_PEER_PORT)
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
  throw new Error("Native release peer requires an unprivileged local port")
const hosts = new Set(["registry.npmjs.org", "api.github.com", "uploads.github.com"])
const refused = () => {
  throw new Error("Native release fixture refused an unlisted network destination")
}
const socketConnect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0]
  const options =
    typeof first === "object" && first !== null
      ? first
      : { port: first, host: typeof args[1] === "string" ? args[1] : undefined }
  if (options.path || options.host !== "127.0.0.1" || Number(options.port) !== port) refused()
  return Reflect.apply(socketConnect, this, args)
}
const tlsConnect = tls.connect
tls.connect = function (options, ...rest) {
  if (
    !options ||
    typeof options !== "object" ||
    !hosts.has(options.host) ||
    Number(options.port ?? 443) !== 443 ||
    options.socket ||
    options.path ||
    options.rejectUnauthorized === false ||
    (options.servername && options.servername !== options.host)
  )
    refused()
  return Reflect.apply(tlsConnect, this, [
    {
      ...options,
      host: "127.0.0.1",
      port,
      servername: options.host,
    },
    ...rest,
  ])
}
// Native TLS uses a numeric loopback address, so it never needs DNS. Denying
// DNS too catches accidental alternative clients before they can contact peers.
for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const name of Object.getOwnPropertyNames(target))
    if (/^(lookup|resolve|reverse)/u.test(name) && typeof target[name] === "function")
      target[name] = refused
}
syncBuiltinESMExports()
