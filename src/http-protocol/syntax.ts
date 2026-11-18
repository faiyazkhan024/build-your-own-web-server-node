import { HTTPError } from "./types";

// Split buffer into lines delimited by \r\n (CRLF)
export function splitLines(data: Buffer): Buffer[] {
  const lines: Buffer[] = [];
  let start = 0;
  while (start < data.length) {
    const idx = data.indexOf("\r\n", start);
    if (idx < 0) {
      lines.push(Buffer.from(data.subarray(start)));
      break;
    }
    lines.push(Buffer.from(data.subarray(start, idx)));
    start = idx + 2;
  }
  return lines;
}

// RFC 9110 token characters: 1*tchar
// tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
//         "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
const TOKEN_REGEXP = /^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/;

// Parse the request line: METHOD SP URI SP VERSION
export function parseRequestLine(line: Buffer): [string, Buffer, string] {
  const str = line.toString("latin1");
  const firstSpace = str.indexOf(" ");
  if (firstSpace < 0) {
    throw new HTTPError(400, "bad request line");
  }
  const secondSpace = str.indexOf(" ", firstSpace + 1);
  if (secondSpace < 0) {
    throw new HTTPError(400, "bad request line");
  }

  const method = str.substring(0, firstSpace);
  if (!TOKEN_REGEXP.test(method)) {
    throw new HTTPError(400, "bad method");
  }

  const uri = Buffer.from(line.subarray(firstSpace + 1, secondSpace));
  if (uri.length === 0) {
    throw new HTTPError(400, "empty uri");
  }

  const versionPart = str.substring(secondSpace + 1);
  // Expect HTTP/1.0 or HTTP/1.1
  const versionMatch = versionPart.match(/^HTTP\/(1\.[01])$/);
  if (!versionMatch) {
    throw new HTTPError(400, "bad HTTP version");
  }
  const version = versionMatch[1]; // "1.0" or "1.1"

  return [method, uri, version];
}

// Validate header field: field-name ":" OWS field-value BWS
export function validateHeader(header: Buffer): boolean {
  // Must not contain CR or LF within the line
  if (header.includes(0x0d) || header.includes(0x0a)) {
    return false;
  }
  const colonIdx = header.indexOf(0x3a); // ':'
  if (colonIdx <= 0) {
    return false;
  }
  const name = header.subarray(0, colonIdx).toString("latin1");
  if (!TOKEN_REGEXP.test(name)) {
    return false;
  }
  return true;
}

// Case-insensitive header lookup
export function fieldGet(headers: Buffer[], key: string): null | Buffer {
  const target = key.toLowerCase();
  for (const h of headers) {
    const colonIdx = h.indexOf(0x3a);
    if (colonIdx < 0) continue;
    const name = h.subarray(0, colonIdx).toString("latin1").trim().toLowerCase();
    if (name === target) {
      // Return value trimmed of OWS (spaces and tabs)
      const valBuf = h.subarray(colonIdx + 1);
      const strVal = valBuf.toString("latin1").trim();
      return Buffer.from(strVal, "latin1");
    }
  }
  return null;
}

// Parse decimal integer
export function parseDec(s: string): number {
  if (!/^\d+$/.test(s.trim())) {
    return NaN;
  }
  return parseInt(s.trim(), 10);
}

// Parse HTTP date string (IMF-fixdate / RFC 9110) into Unix seconds
export function parseHTTPDate(dateStr: string): number {
  const ms = Date.parse(dateStr.trim());
  if (isNaN(ms)) {
    return -1;
  }
  return Math.floor(ms / 1000);
}

// Split comma-separated header values into string array
export function fieldGetList(headers: Buffer[], key: string): string[] {
  const val = fieldGet(headers, key);
  if (!val) return [];
  return val
    .toString("latin1")
    .split(",")
    .map((item) => {
      const semi = item.indexOf(";");
      return (semi >= 0 ? item.substring(0, semi) : item).trim().toLowerCase();
    })
    .filter((s) => s.length > 0);
}
