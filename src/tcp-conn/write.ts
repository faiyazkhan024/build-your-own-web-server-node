import { TCPConn } from "./types";

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
