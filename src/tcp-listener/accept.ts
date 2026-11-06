import { TCPConn } from "../tcp-conn";
import { TCPListener } from "./types";

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
