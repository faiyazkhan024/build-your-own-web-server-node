import { HTTPReq, HTTPRes, fieldGet, fieldGetList } from "../http-protocol";
import { gzipFilter, deflateFilter } from "./filter";

// Check header fields and optionally enable HTTP response compression
export function enableCompression(req: HTTPReq, res: HTTPRes): void {
  // Inform proxies that the response representation varies by Accept-Encoding
  res.headers.push(Buffer.from("Vary: Accept-Encoding"));

  // Incompatible with Range requests
  if (fieldGet(req.headers, "Range")) {
    return;
  }

  // Check client accepted encodings
  const codecs: string[] = fieldGetList(req.headers, "Accept-Encoding");
  if (codecs.includes("gzip")) {
    res.headers.push(Buffer.from("Content-Encoding: gzip"));
    res.body = gzipFilter(res.body);
  } else if (codecs.includes("deflate")) {
    res.headers.push(Buffer.from("Content-Encoding: deflate"));
    res.body = deflateFilter(res.body);
  }
}
