import * as net from "net";
import { TCPConn, soRead } from "../tcp-conn";
import { TCPListener, soListen, soAccept } from "../tcp-listener";
import { DynBuf, bufPush, createDynBuf } from "../dyn-buf";
import {
  HTTPReq,
  HTTPRes,
  HTTPError,
  BodyReader,
  cutHTTPReq,
  readerFromReq,
  readerFromMemory,
  writeHTTPResp,
} from "../http-protocol";
import { handleReq } from "./handler";

// HTTP client connection loop
export async function serveClient(
  conn: TCPConn,
  handler: (req: HTTPReq, body: BodyReader) => Promise<HTTPRes> = handleReq
): Promise<void> {
  const buf: DynBuf = createDynBuf();

  while (true) {
    // try to get 1 request header from the buffer
    const msg: null | HTTPReq = cutHTTPReq(buf);
    if (!msg) {
      // need more data
      const data = await soRead(conn);
      bufPush(buf, data);
      // EOF?
      if (data.length === 0 && buf.length === 0) {
        return; // normal EOF: no more requests
      }
      if (data.length === 0) {
        throw new HTTPError(400, "Unexpected EOF.");
      }
      // got some data, try again
      continue;
    }

    // process the message and send the response
    const reqBody: BodyReader = readerFromReq(conn, buf, msg);
    const res: HTTPRes = await handler(msg, reqBody);
    await writeHTTPResp(conn, res);

    // close the connection for HTTP/1.0
    if (msg.version === "1.0") {
      return;
    }

    // make sure that the request body is consumed completely before next request
    while ((await reqBody.read()).length > 0) {
      /* discard unread body bytes */
    }
  }
}

export async function newConn(
  conn: TCPConn,
  handler: (req: HTTPReq, body: BodyReader) => Promise<HTTPRes> = handleReq
): Promise<void> {
  console.log("new connection", conn.socket.remoteAddress, conn.socket.remotePort);

  try {
    await serveClient(conn, handler);
  } catch (exc) {
    console.error("exception:", exc);
    if (exc instanceof HTTPError) {
      // Send error response
      const resp: HTTPRes = {
        code: exc.code,
        headers: [],
        body: readerFromMemory(Buffer.from(exc.message + "\n")),
      };
      try {
        await writeHTTPResp(conn, resp);
      } catch (err) {
        /* ignore write error during disconnect */
      }
    }
  } finally {
    conn.socket.destroy();
  }
}

export async function startHTTPServer(
  options: { host: string; port: number } = { host: "127.0.0.1", port: 1234 },
  handler: (req: HTTPReq, body: BodyReader) => Promise<HTTPRes> = handleReq
): Promise<TCPListener> {
  const listener: TCPListener = soListen(options);
  console.log(`HTTP server listening on ${options.host}:${options.port}`);

  (async () => {
    while (true) {
      const conn: TCPConn = await soAccept(listener);
      newConn(conn, handler);
    }
  })().catch((err: Error) => {
    console.error("server accept loop error:", err);
  });

  return listener;
}
