import { createServer } from "node:net"
const sockets = new Set()
const server = createServer((socket) => {
  sockets.add(socket)
  socket.on("error", () => {})
  socket.once("data", () => process.send({ event: "handshake" }))
  socket.once("close", () => {
    sockets.delete(socket)
    process.send({ event: "closed", count: sockets.size })
  })
})
server.listen(0, "127.0.0.1", () => process.send({ event: "ready", port: server.address().port }))
process.on("disconnect", () => {
  for (const socket of sockets) socket.destroy()
  server.close()
})
