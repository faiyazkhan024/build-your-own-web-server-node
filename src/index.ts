import * as net from "net";
import { TCPConn, soInit, soRead, soWrite } from "./tcp-conn";
import { TCPListener, soListen, soAccept } from "./tcp-listener";
import { DynBuf, bufPush, createDynBuf } from "./dyn-buf";
import { cutMessage } from "./message-protocol";

// echo server
async function serveClient(socketOrConn: net.Socket | TCPConn): Promise<void> {
  const conn: TCPConn =
    "socket" in socketOrConn ? socketOrConn : soInit(socketOrConn);

  const buf: DynBuf = createDynBuf();
  while (true) {
    // try to get 1 message from the buffer
    const msg: null | Buffer = cutMessage(buf);
    if (!msg) {
      // need more data
      const data: Buffer = await soRead(conn);
      bufPush(buf, data);
      // EOF?
      if (data.length === 0) {
        return;
      }
      // got some data, try it again.
      continue;
    }

    // process the message and send the response
    if (msg.equals(Buffer.from("quit\n"))) {
      await soWrite(conn, Buffer.from("Bye.\n"));
      conn.socket.destroy();
      return;
    } else {
      const reply = Buffer.concat([Buffer.from("Echo:"), msg]);
      await soWrite(conn, reply);
    }
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
