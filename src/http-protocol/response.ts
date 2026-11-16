import { TCPConn, soWrite } from "../tcp-conn";
import { HTTPRes, HTTP_STATUS_TEXT } from "./types";
import { fieldGet } from "./syntax";

// Encode an HTTP response header into a byte buffer
export function encodeHTTPResp(resp: HTTPRes): Buffer {
  const statusText = HTTP_STATUS_TEXT[resp.code] || "OK";
  const lines: Buffer[] = [
    Buffer.from(`HTTP/1.1 ${resp.code} ${statusText}\r\n`),
  ];
  for (const h of resp.headers) {
    lines.push(h);
    lines.push(Buffer.from("\r\n"));
  }
  lines.push(Buffer.from("\r\n"));
  return Buffer.concat(lines);
}

// Send an HTTP response through the socket
export async function writeHTTPResp(
  conn: TCPConn,
  resp: HTTPRes
): Promise<void> {
  // set the "Content-Length" or "Transfer-Encoding" field
  if (resp.body.length < 0) {
    if (!fieldGet(resp.headers, "Transfer-Encoding")) {
      resp.headers.push(Buffer.from("Transfer-Encoding: chunked"));
    }
  } else {
    if (!fieldGet(resp.headers, "Content-Length")) {
      resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`));
    }
  }

  // write the header (combined write to avoid Nagle delays)
  await soWrite(conn, encodeHTTPResp(resp));

  // write the body
  const crlf = Buffer.from("\r\n");
  for (let last = false; !last; ) {
    let data = await resp.body.read();
    last = data.length === 0; // ended?
    if (resp.body.length < 0) {
      // chunked encoding
      data = Buffer.concat([
        Buffer.from(data.length.toString(16)),
        crlf,
        data,
        crlf,
      ]);
    }
    if (data.length > 0) {
      await soWrite(conn, data);
    }
  }
}
