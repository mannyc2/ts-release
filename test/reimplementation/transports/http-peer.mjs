import { createServer } from "node:http"

let writes = 0
const server = createServer((request, response) => {
  request.on("error", (error) => {
    console.error(error)
    process.exitCode = 1
    response.destroy(error)
  })
  request.on("end", () => {
    writes++
    process.send({ event: "committed", writes })
  })
  request.resume() // Consume the complete request without retaining its body.
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
