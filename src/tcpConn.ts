import * as net from "net";
import { TCPConn, soInit } from "./tcp-conn";

export * from "./tcp-conn";

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
