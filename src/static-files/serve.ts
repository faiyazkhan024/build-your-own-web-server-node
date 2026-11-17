import * as fs from "fs/promises";
import * as path from "path";
import { HTTPRes, BodyReader, readerFromMemory } from "../http-protocol";
import { getMimeType } from "./mime";

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

// BodyReader from a static file handle with buffer reuse
export function readerFromStaticFile(
  fp: fs.FileHandle,
  size: number
): BodyReader {
  let got = 0; // bytes read so far
  const buf = Buffer.allocUnsafe(65536); // reused 64KB buffer for each read

  return {
    length: size,
    read: async (): Promise<Buffer> => {
      const r = await fp.read({ buffer: buf });
      got += r.bytesRead;
      if (got > size || (got < size && r.bytesRead === 0)) {
        // unhappy case: file size changed during read
        throw new Error("file size changed, abandon it!");
      }
      return r.buffer.subarray(0, r.bytesRead);
    },
    close: async (): Promise<void> => {
      await fp.close();
    },
  };
}

// Safely serve a file from the base directory
export async function serveStaticFile(
  relPath: string,
  baseDir: string = process.cwd()
): Promise<HTTPRes> {
  // Prevent directory traversal attacks
  const decoded = decodeURIComponent(relPath);
  if (decoded.includes("\0") || decoded.includes("..")) {
    return resp403("Access Denied: Path Traversal Detected\n");
  }

  const safePath = path.resolve(baseDir, decoded);
  // Ensure the resolved path resides within the base directory
  if (!safePath.startsWith(path.resolve(baseDir))) {
    return resp403("Access Denied: Directory Traversal Detected\n");
  }

  let fp: null | fs.FileHandle = null;
  try {
    // Open the file in read-only mode
    fp = await fs.open(safePath, "r");
    const stat = await fp.stat();
    if (!stat.isFile()) {
      return resp404(); // Directory or special device
    }

    const size = stat.size;
    const reader: BodyReader = readerFromStaticFile(fp, size);
    // Transfer ownership to BodyReader so finally block doesn't close prematurely
    fp = null;

    const mime = getMimeType(safePath);
    return {
      code: 200,
      headers: [
        Buffer.from(`Content-Type: ${mime}`),
        Buffer.from("Accept-Ranges: bytes"),
      ],
      body: reader,
    };
  } catch (exc) {
    // File does not exist or permission denied
    return resp404();
  } finally {
    // Make sure file handle is closed if an error occurred before transfer
    await fp?.close();
  }
}
