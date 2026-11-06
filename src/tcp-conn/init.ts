import * as net from "net";
import { TCPConn } from "./types";

// create a wrapper from net.Socket
export const soInit = (socket: net.Socket): TCPConn => {
  const conn: TCPConn = {
    socket: socket,
    err: null,
    ended: false,
    reader: null,
  };

  socket.on("data", (data: Buffer) => {
    console.assert(conn.reader);

    // pause the 'data' event until the next read.
    conn.socket.pause();

    // fulfill the promise of the current read.
    conn.reader!.resolve(data);
    conn.reader = null;
  });

  socket.on("end", () => {
    // this also fulfills the current read.
    conn.ended = true;
    if (conn.reader) {
      conn.reader.resolve(Buffer.from("")); // EOF
      conn.reader = null;
    }
  });

  socket.on("error", (err: Error) => {
    // errors are also delivered to the current read.
    conn.err = err;
    if (conn.reader) {
      conn.reader.reject(err);
      conn.reader = null;
    }
  });

  return conn;
};
