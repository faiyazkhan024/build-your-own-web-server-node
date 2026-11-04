import * as net from "net";

// A promise-based API for TCP sockets.
interface TCPConn {
  // the JS socket object
  socket: net.Socket;

  // the callbacks of the promise of the current read
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  };
}

// create a wrapper from net.Socket
export const soInit = (socket: net.Socket): TCPConn => {
  const conn: TCPConn = { socket: socket, reader: null };

  socket.on("data", (data: Buffer) => {
    console.assert(conn.reader);

    // pause the 'data' event until the next read.
    conn.socket.pause();

    // fulfill the promise of the current read.
    conn.reader!.resolve(data);
    conn.reader = null;
  });

  return conn;
};

export const soRead = (conn: TCPConn): Promise<Buffer> => {
  console.assert(!conn.reader); // no concurrent calls

  return new Promise((resolve, reject) => {
    // save the promise callbacks
    conn.reader = { resolve: resolve, reject: reject };

    // and resume the 'data' event to fulfill the promise later.
    conn.socket.resume();
  });
};
