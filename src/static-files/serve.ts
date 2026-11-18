import * as fs from "fs/promises";
import type { Stats } from "fs";
import * as path from "path";
import {
  HTTPReq,
  HTTPRes,
  BodyReader,
  readerFromMemory,
  fieldGet,
  parseHTTPDate,
} from "../http-protocol";
import { getMimeType } from "./mime";
import { parseBytesRanges, computeEffectiveRange } from "./range";

export function resp404(msg: string = "Not Found\n"): HTTPRes {
  return {
    code: 404,
    headers: [Buffer.from("Content-Type: text/plain; charset=utf-8")],
    body: readerFromMemory(Buffer.from(msg)),
  };
}

export function resp403(msg: string = "Forbidden\n"): HTTPRes {
  return {
    code: 403,
    headers: [Buffer.from("Content-Type: text/plain; charset=utf-8")],
    body: readerFromMemory(Buffer.from(msg)),
  };
}

// BodyReader from a static file handle reading [start, end)
export function readerFromStaticFile(
  fp: fs.FileHandle,
  start: number,
  end: number
): BodyReader {
  let offset = start;
  const buf = Buffer.allocUnsafe(65536); // reused 64KB buffer

  return {
    length: end - start,
    read: async (): Promise<Buffer> => {
      if (offset >= end) {
        return Buffer.from(""); // EOF for this range
      }
      const maxread = Math.min(buf.length, end - offset);
      const r = await fp.read({
        buffer: buf,
        position: offset,
        length: maxread,
      });
      if (r.bytesRead === 0 && offset < end) {
        throw new Error("unexpected EOF while reading file range");
      }
      offset += r.bytesRead;
      return r.buffer.subarray(0, r.bytesRead);
    },
    close: async (): Promise<void> => {
      await fp.close();
    },
  };
}

// Generate full or partial range response with HTTP caching validators
export function staticFileResp(
  req: HTTPReq,
  fp: fs.FileHandle,
  stat: Stats,
  safePath: string
): HTTPRes {
  const mime = getMimeType(safePath);
  const ts = Math.floor(stat.mtime.getTime() / 1000); // Unix timestamp in seconds

  const commonHeaders: Buffer[] = [
    Buffer.from(`Content-Type: ${mime}`),
    Buffer.from("Accept-Ranges: bytes"),
    Buffer.from(`Last-Modified: ${stat.mtime.toUTCString()}`),
    Buffer.from("Cache-Control: public, max-age=3600"),
  ];

  // 1. Check If-Modified-Since for conditional cache validation
  const ifm = fieldGet(req.headers, "If-Modified-Since");
  if (ifm && parseHTTPDate(ifm.toString("latin1")) === ts) {
    const empty = readerFromMemory(Buffer.from(""));
    return {
      code: 304,
      headers: [
        Buffer.from(`Last-Modified: ${stat.mtime.toUTCString()}`),
        Buffer.from("Cache-Control: public, max-age=3600"),
      ],
      body: empty,
    };
  }

  // 2. Check If-Range validator for range requests
  let rangeHeader = fieldGet(req.headers, "Range");
  const ifr = fieldGet(req.headers, "If-Range");
  if (ifr && parseHTTPDate(ifr.toString("latin1")) !== ts) {
    rangeHeader = null; // Ignore Range header if If-Range timestamp does not match
  }

  if (rangeHeader) {
    const ranges = parseBytesRanges(rangeHeader);
    if (ranges.length > 0) {
      const eff = computeEffectiveRange(ranges[0], stat.size);
      if (!eff) {
        // Range Not Satisfiable
        return {
          code: 416,
          headers: [
            Buffer.from("Content-Type: text/plain; charset=utf-8"),
            Buffer.from(`Content-Range: bytes */${stat.size}`),
          ],
          body: readerFromMemory(Buffer.from("Range Not Satisfiable\n")),
        };
      }

      // 206 Partial Content
      const [start, end] = eff;
      const reader = readerFromStaticFile(fp, start, end);
      return {
        code: 206,
        headers: [
          ...commonHeaders,
          Buffer.from(`Content-Range: bytes ${start}-${end - 1}/${stat.size}`),
        ],
        body: reader,
      };
    }
  }

  // 200 OK full file response
  const reader = readerFromStaticFile(fp, 0, stat.size);
  return {
    code: 200,
    headers: commonHeaders,
    body: reader,
  };
}

// Safely serve a file from the base directory
export async function serveStaticFile(
  req: HTTPReq,
  relPath: string,
  baseDir: string = process.cwd()
): Promise<HTTPRes> {
  // Prevent directory traversal attacks
  const decoded = decodeURIComponent(relPath);
  if (decoded.includes("\0") || decoded.includes("..")) {
    return resp403("Access Denied: Path Traversal Detected\n");
  }

  const safePath = path.resolve(baseDir, decoded);
  if (!safePath.startsWith(path.resolve(baseDir))) {
    return resp403("Access Denied: Directory Traversal Detected\n");
  }

  let fp: null | fs.FileHandle = null;
  try {
    fp = await fs.open(safePath, "r");
    const stat = await fp.stat();
    if (!stat.isFile()) {
      return resp404();
    }

    try {
      return staticFileResp(req, fp, stat, safePath);
    } finally {
      // Ownership transferred to BodyReader in staticFileResp
      fp = null;
    }
  } catch (exc) {
    return resp404();
  } finally {
    await fp?.close();
  }
}
