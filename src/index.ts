import * as net from "net";

function newConn(socket: net.Socket): void {
  console.log("new connection", socket.remoteAddress, socket.remotePort);
}

const server = net.createServer();
server.on("error", (err: Error) => {
  throw err;
});
server.on("connection", newConn);
server.listen({ host: "127.0.0.1", port: 1234 });
