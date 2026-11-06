import * as net from "net";
import { TCPConn, soInit, soRead, soWrite } from "./tcp-conn";
import { TCPListener, soListen, soAccept } from "./tcp-listener";

// echo server
async function serveClient(socketOrConn: net.Socket | TCPConn): Promise<void> {
  const conn: TCPConn =
    "socket" in socketOrConn ? socketOrConn : soInit(socketOrConn);

  while (true) {
    const data = await soRead(conn);

    if (data.length === 0) {
      console.log("end connection");
      break;
    }

    console.log("data", data);
    await soWrite(conn, data);
  }
}

async function newConn(conn: TCPConn): Promise<void> {
  console.log("new connection", conn.socket.remoteAddress, conn.socket.remotePort);

  try {
    await serveClient(conn);
  } catch (exc) {
    console.error("exception:", exc);
  } finally {
    conn.socket.destroy();
  }
}

async function main(): Promise<void> {
  const listener: TCPListener = soListen({ host: "127.0.0.1", port: 1234 });
  console.log("server listening on 127.0.0.1:1234");

  while (true) {
    const conn: TCPConn = await soAccept(listener);
    // Start concurrent client task without awaiting it
    newConn(conn);
  }
}

main().catch((err: Error) => {
  console.error("server error:", err);
});
