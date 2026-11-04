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
