import * as net from "net";

// A promise-based API for TCP sockets.
interface TCPConn {
  // the JS socket object
  socket: net.Socket;

  // from the 'error' event
  err: null | Error;

  // EOF, from the 'end' event
  ended: boolean;

  // the callbacks of the promise of the current read
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  };
}

// create a wrapper from net.Socket
export const soInit = (socket: net.Socket): TCPConn => {
  const conn: TCPConn = {
    socket: socket,
    err: null,
    ended: false,
    reader: null,
  };

  socket.on("data", (data: Buffer) => {
    // omitted ...
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

// returns an empty `Buffer` after EOF.
export const soRead = (conn: TCPConn): Promise<Buffer> => {
  console.assert(!conn.reader); // no concurrent calls

  return new Promise((resolve, reject) => {
    // if the connection is not readable, complete the promise now.
    if (conn.err) return reject(conn.err);
    if (conn.ended) return resolve(Buffer.from("")); // EOF

    // save the promise callbacks
    conn.reader = { resolve: resolve, reject: reject };

    // and resume the 'data' event to fulfill the promise later.
    conn.socket.resume();
  });
};

export const soWrite = (conn: TCPConn, data: Buffer): Promise<void> => {
  console.assert(data.length > 0);

  return new Promise((resolve, reject) => {
    if (conn.err) return reject(conn.err);

    conn.socket.write(data, (err?: Error | null) => {
      if (err) return reject(err);
      else return resolve();
    });
  });
};
