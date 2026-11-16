import { TCPConn, soRead } from "../tcp-conn";
import { DynBuf, bufPush, bufPop } from "../dyn-buf";
import { HTTPError, BufferGenerator } from "./types";

// Helper to read more data into buffer or throw unexpected EOF
export async function bufExpectMore(
  conn: TCPConn,
  buf: DynBuf,
  context: string
): Promise<void> {
  const data = await soRead(conn);
  bufPush(buf, data);
  if (data.length === 0) {
    throw new HTTPError(400, `Unexpected EOF while reading ${context}`);
  }
}

// Decode the chunked encoding and yield the data on the fly
export async function* readChunks(
  conn: TCPConn,
  buf: DynBuf
): BufferGenerator {
  for (let last = false; !last; ) {
    // read the chunk-size line
    let idx = buf.data.subarray(0, buf.length).indexOf("\r\n");
    while (idx < 0) {
      if (buf.length >= 1024) {
        throw new HTTPError(400, "chunk header is too large");
      }
      await bufExpectMore(conn, buf, "chunk-size");
      idx = buf.data.subarray(0, buf.length).indexOf("\r\n");
    }

    // parse the chunk-size line: chunk-size [ chunk-ext ] CRLF
    const line = buf.data.subarray(0, idx).toString("latin1").trim();
    const semiIdx = line.indexOf(";");
    const hexStr = semiIdx >= 0 ? line.substring(0, semiIdx).trim() : line;
    const remainHex = parseInt(hexStr, 16);
    if (isNaN(remainHex) || remainHex < 0) {
      throw new HTTPError(400, "bad chunk-size");
    }

    // pop the chunk-size line including CRLF
    bufPop(buf, idx + 2);

    let remain = remainHex;
    // is it the last one?
    last = remain === 0;

    // read and yield the chunk data
    while (remain > 0) {
      if (buf.length === 0) {
        await bufExpectMore(conn, buf, "chunk data");
      }
      const consume = Math.min(remain, buf.length);
      const data = Buffer.from(buf.data.subarray(0, consume));
      bufPop(buf, consume);
      remain -= consume;
      yield data;
    }

    // the chunk data (or 0-chunk) is followed by CRLF
    while (buf.length < 2) {
      await bufExpectMore(conn, buf, "chunk CRLF");
    }
    if (buf.data[0] !== 0x0d || buf.data[1] !== 0x0a) {
      throw new HTTPError(400, "bad chunk delimiter");
    }
    bufPop(buf, 2);
  }
}
