import * as net from "net";
import { TCPConn, soInit } from "../tcp-conn";
import { TCPListener } from "./types";

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
