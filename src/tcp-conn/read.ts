import { TCPConn } from "./types";

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
