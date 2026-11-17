import * as fs from "fs/promises";
import * as path from "path";
import {
  HTTPReq,
  HTTPRes,
  BodyReader,
  readerFromMemory,
  fieldGet,
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

// Generate full or partial range response for an opened static file
export function staticFileResp(
  req: HTTPReq,
  fp: fs.FileHandle,
  size: number,
  safePath: string
): HTTPRes {
  const mime = getMimeType(safePath);
  const rangeHeader = fieldGet(req.headers, "Range");

  if (rangeHeader) {
    const ranges = parseBytesRanges(rangeHeader);
    if (ranges.length > 0) {
      const eff = computeEffectiveRange(ranges[0], size);
      if (!eff) {
        // Range Not Satisfiable
        return {
          code: 416,
          headers: [
            Buffer.from("Content-Type: text/plain; charset=utf-8"),
            Buffer.from(`Content-Range: bytes */${size}`),
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
          Buffer.from(`Content-Type: ${mime}`),
          Buffer.from("Accept-Ranges: bytes"),
          Buffer.from(`Content-Range: bytes ${start}-${end - 1}/${size}`),
        ],
        body: reader,
      };
    }
  }

  // 200 OK full file response
  const reader = readerFromStaticFile(fp, 0, size);
  return {
    code: 200,
    headers: [
      Buffer.from(`Content-Type: ${mime}`),
      Buffer.from("Accept-Ranges: bytes"),
    ],
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

    const size = stat.size;
    try {
      return staticFileResp(req, fp, size, safePath);
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
