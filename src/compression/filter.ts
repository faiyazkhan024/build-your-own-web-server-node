import * as stream from "stream";
import { pipeline } from "stream/promises";
import * as zlib from "zlib";
import { BodyReader } from "../http-protocol";

// Convert BodyReader into Node.js stream.Readable
export function body2stream(reader: BodyReader): stream.Readable {
  let self: null | stream.Readable = null;
  self = new stream.Readable({
    read: async () => {
      try {
        const data: Buffer = await reader.read();
        self!.push(data.length > 0 ? data : null);
      } catch (err) {
        self!.destroy(err instanceof Error ? err : new Error("IO"));
      }
    },
  });
  return self;
}

// Wrap BodyReader with gzip compressor using pipeline()
export function gzipFilter(
  reader: BodyReader,
  syncFlush: boolean = false
): BodyReader {
  const gz: stream.Duplex = zlib.createGzip(
    syncFlush ? { flush: zlib.constants.Z_SYNC_FLUSH } : {}
  );
  const input: stream.Readable = body2stream(reader);

  pipeline(input, gz).catch((err: Error) => gz.destroy(err));

  const iter: AsyncIterator<Buffer> = gz.iterator();
  return {
    length: -1, // compressed length is dynamic/unknown
    read: async (): Promise<Buffer> => {
      const r: IteratorResult<Buffer, void> = await iter.next();
      return r.done ? Buffer.from("") : r.value;
    },
    close: reader.close,
  };
}

// Wrap BodyReader with deflate compressor using pipeline()
export function deflateFilter(
  reader: BodyReader,
  syncFlush: boolean = false
): BodyReader {
  const def: stream.Duplex = zlib.createDeflate(
    syncFlush ? { flush: zlib.constants.Z_SYNC_FLUSH } : {}
  );
  const input: stream.Readable = body2stream(reader);

  pipeline(input, def).catch((err: Error) => def.destroy(err));

  const iter: AsyncIterator<Buffer> = def.iterator();
  return {
    length: -1,
    read: async (): Promise<Buffer> => {
      const r: IteratorResult<Buffer, void> = await iter.next();
      return r.done ? Buffer.from("") : r.value;
    },
    close: reader.close,
  };
}
