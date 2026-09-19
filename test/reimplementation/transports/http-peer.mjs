import { createServer } from "node:http"

let writes = 0
const server = createServer(async (request) => {
  for await (const _ of request) {
    /* consume the complete native request */
  }
  writes++
  process.send({ event: "committed", writes })
})
server.on("connection", (socket) => {
  socket.on("close", () => process.send({ event: "socket-closed", writes }))
})
server.listen(0, "127.0.0.1", () => {
  process.send({
    event: "ready",
    url: `http://127.0.0.1:${server.address().port}/artifact`,
    runtime: process.version,
  })
})
process.on("disconnect", () => {
  server.closeAllConnections()
  server.close()
})
