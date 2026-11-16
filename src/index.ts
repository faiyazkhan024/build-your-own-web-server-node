import { TCPConn, soRead } from "./tcp-conn";
import { TCPListener, soListen, soAccept } from "./tcp-listener";
import { DynBuf, bufPush, createDynBuf } from "./dyn-buf";
import {
  HTTPReq,
  HTTPRes,
  HTTPError,
  BodyReader,
  cutHTTPReq,
  readerFromReq,
  readerFromMemory,
  writeHTTPResp,
} from "./http-protocol";

// A sample request handler
async function handleReq(req: HTTPReq, body: BodyReader): Promise<HTTPRes> {
  let resp: BodyReader;
  const path = req.uri.toString("latin1");

  switch (path) {
    case "/echo":
      // HTTP echo endpoint
      resp = body;
      break;
    default:
      resp = readerFromMemory(Buffer.from("hello world.\n"));
      break;
  }

  return {
    code: 200,
    headers: [Buffer.from("Server: my_first_http_server")],
    body: resp,
  };
}

// HTTP client connection loop
async function serveClient(conn: TCPConn): Promise<void> {
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
    const res: HTTPRes = await handleReq(msg, reqBody);
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

async function newConn(conn: TCPConn): Promise<void> {
  console.log("new connection", conn.socket.remoteAddress, conn.socket.remotePort);

  try {
    await serveClient(conn);
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

async function main(): Promise<void> {
  const listener: TCPListener = soListen({ host: "127.0.0.1", port: 1234 });
  console.log("HTTP server listening on 127.0.0.1:1234");

  while (true) {
    const conn: TCPConn = await soAccept(listener);
    // Start concurrent client task without awaiting it
    newConn(conn);
  }
}

main().catch((err: Error) => {
  console.error("server error:", err);
});
