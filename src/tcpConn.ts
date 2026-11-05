import * as net from "net";

// A promise-based API for TCP sockets.
export interface TCPConn {
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

// A promise-based API for TCP listening sockets.
export interface TCPListener {
  // the JS server / listening socket object
  server: net.Server;
  // alias for compatibility with the book's naming
  socket?: net.Server;
  // from the 'error' event
  err: null | Error;
  // buffered connections awaiting an accept call
  queue: TCPConn[];
  // the callback of the promise of the current accept
  acceptor: null | {
    resolve: (conn: TCPConn) => void;
    reject: (reason: Error) => void;
  };
}

export const soListen = (
  options: net.ListenOptions | number,
  host?: string,
): TCPListener => {
  const server: net.Server = net.createServer({
    pauseOnConnect: true, // required by `TCPConn`
  });

  const listener: TCPListener = {
    server: server,
    get socket() {
      return this.server;
    },
    err: null,
    queue: [],
    acceptor: null,
  };

  server.on("connection", (socket: net.Socket) => {
    const conn: TCPConn = soInit(socket);
    if (listener.acceptor) {
      const acceptor = listener.acceptor;
      listener.acceptor = null;
      acceptor.resolve(conn);
    } else {
      listener.queue.push(conn);
    }
  });

  server.on("error", (err: Error) => {
    listener.err = err;
    if (listener.acceptor) {
      const acceptor = listener.acceptor;
      listener.acceptor = null;
      acceptor.reject(err);
    }
  });

  server.on("close", () => {
    if (listener.acceptor) {
      const acceptor = listener.acceptor;
      listener.acceptor = null;
      acceptor.reject(new Error("Server closed"));
    }
  });

  if (typeof options === "number") {
    server.listen(options, host);
  } else {
    server.listen(options);
  }

  return listener;
};

export const soAccept = (listener: TCPListener): Promise<TCPConn> => {
  return new Promise((resolve, reject) => {
    if (listener.err) return reject(listener.err);

    // If there is an accepted connection in the queue, fulfill immediately.
    if (listener.queue.length > 0) {
      return resolve(listener.queue.shift()!);
    }

    console.assert(!listener.acceptor, "no concurrent calls to soAccept");
    listener.acceptor = { resolve, reject };
  });
};
