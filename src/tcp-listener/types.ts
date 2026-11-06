import * as net from "net";
import { TCPConn } from "../tcp-conn";

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
