import { DynBuf, bufPop } from "../dyn-buf";
import { HTTPError, HTTPReq } from "./types";
import { splitLines, parseRequestLine, validateHeader } from "./syntax";

// The maximum length of an HTTP header (8KB)
export const kMaxHeaderLen = 1024 * 8;

// Parse an HTTP request header from a buffer ending with CRLF CRLF
export function parseHTTPReq(data: Buffer): HTTPReq {
  // split the data into lines
  const lines: Buffer[] = splitLines(data);
  // the first line is `METHOD URI VERSION`
  const [method, uri, version] = parseRequestLine(lines[0]);
  // followed by header fields in the format of `Name: value`
  const headers: Buffer[] = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const h = Buffer.from(lines[i]); // copy
    if (!validateHeader(h)) {
      throw new HTTPError(400, "bad field");
    }
    headers.push(h);
  }
  // the header ends by an empty line
  console.assert(lines[lines.length - 1].length === 0);
  return {
    method,
    uri,
    version,
    headers,
  };
}

// Parse & remove an HTTP header from the beginning of the buffer if possible
export function cutHTTPReq(buf: DynBuf): null | HTTPReq {
  // the end of the header is marked by '\r\n\r\n'
  const idx = buf.data.subarray(0, buf.length).indexOf("\r\n\r\n");
  if (idx < 0) {
    if (buf.length >= kMaxHeaderLen) {
      throw new HTTPError(413, "header is too large");
    }
    return null; // need more data
  }
  // parse & remove the header
  const msg = parseHTTPReq(buf.data.subarray(0, idx + 4));
  bufPop(buf, idx + 4);
  return msg;
}
