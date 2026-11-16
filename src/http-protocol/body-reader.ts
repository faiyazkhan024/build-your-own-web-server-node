import { TCPConn, soRead } from "../tcp-conn";
import { DynBuf, bufPush, bufPop } from "../dyn-buf";
import { HTTPError, HTTPReq, BodyReader, BufferGenerator } from "./types";
import { fieldGet, parseDec } from "./syntax";
import { readChunks } from "./chunked";

// BodyReader from in-memory data
export function readerFromMemory(data: Buffer): BodyReader {
  let done = false;
  return {
    length: data.length,
    read: async (): Promise<Buffer> => {
      if (done) {
        return Buffer.from(""); // no more data (EOF)
      } else {
        done = true;
        return data;
      }
    },
  };
}

// BodyReader from an AsyncGenerator
export function readerFromGenerator(gen: BufferGenerator): BodyReader {
  return {
    length: -1,
    read: async (): Promise<Buffer> => {
      const r = await gen.next();
      if (r.done) {
        return Buffer.from(""); // EOF
      } else {
        console.assert(r.value && r.value.length > 0);
        return r.value;
      }
    },
  };
}

// BodyReader from a socket with a known length
export function readerFromConnLength(
  conn: TCPConn,
  buf: DynBuf,
  remain: number
): BodyReader {
  return {
    length: remain,
    read: async (): Promise<Buffer> => {
      if (remain === 0) {
        return Buffer.from(""); // done
      }
      if (buf.length === 0) {
        // try to get some data if there is none
        const data = await soRead(conn);
        bufPush(buf, data);
        if (data.length === 0) {
          // expect more data!
          throw new HTTPError(400, "Unexpected EOF from HTTP body");
        }
      }
      // consume data from the buffer
      const consume = Math.min(buf.length, remain);
      remain -= consume;
      const data = Buffer.from(buf.data.subarray(0, consume));
      bufPop(buf, consume);
      return data;
    },
  };
}

// BodyReader from socket until EOF (HTTP/1.0 compatibility)
export function readerFromConnEOF(conn: TCPConn, buf: DynBuf): BodyReader {
  return {
    length: -1,
    read: async (): Promise<Buffer> => {
      if (buf.length > 0) {
        const data = Buffer.from(buf.data.subarray(0, buf.length));
        bufPop(buf, buf.length);
        return data;
      }
      return await soRead(conn);
    },
  };
}

// BodyReader from an HTTP request
export function readerFromReq(
  conn: TCPConn,
  buf: DynBuf,
  req: HTTPReq
): BodyReader {
  let bodyLen = -1;
  const contentLen = fieldGet(req.headers, "Content-Length");
  if (contentLen) {
    bodyLen = parseDec(contentLen.toString("latin1"));
    if (isNaN(bodyLen)) {
      throw new HTTPError(400, "bad Content-Length.");
    }
  }

  const bodyAllowed = !(req.method === "GET" || req.method === "HEAD");
  const transferEncoding = fieldGet(req.headers, "Transfer-Encoding");
  const chunked =
    transferEncoding?.equals(Buffer.from("chunked")) || false;

  if (!bodyAllowed && (bodyLen > 0 || chunked)) {
    throw new HTTPError(400, "HTTP body not allowed.");
  }
  if (!bodyAllowed) {
    bodyLen = 0;
  }

  if (bodyLen >= 0) {
    // "Content-Length" is present
    return readerFromConnLength(conn, buf, bodyLen);
  } else if (chunked) {
    // chunked encoding
    return readerFromGenerator(readChunks(conn, buf));
  } else {
    // read the rest of the connection (HTTP/1.0 close delimited)
    return readerFromConnEOF(conn, buf);
  }
}
