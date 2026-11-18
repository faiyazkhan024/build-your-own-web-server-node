# Test Results: Chapter 12 – Compression & the Stream API

- **Date**: 2026-11-18
- **Component**: Node.js Stream API, Compression Filters & Content Negotiation (`src/compression/`, `src/http-server/server.ts`)
- **Specification**: RFC 9110 (Content Negotiation, Accept-Encoding, Content-Encoding, Vary)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: `curl`

---

## 1. Chapter Overview

Chapter 12 integrates Node.js `stream` and `zlib` primitives with the custom server architecture:
- **Stream Adapters (`body2stream`)**: Bridges `BodyReader` to `stream.Readable`, respecting backpressure by pushing chunks on demand in the `read()` callback.
- **Transform Pipelines (`pipeline()`)**: Connects readable sources directly to `zlib.createGzip()` and `zlib.createDeflate()` compressors to avoid memory bloat and backpressure deadlocks.
- **Content Negotiation (`enableCompression`)**: Parses `Accept-Encoding` header lists, selects optimal codecs (`gzip` or `deflate`), sets `Content-Encoding`, and switches responses to dynamic chunked transfer encoding.
- **Range Incompatibility**: Forbids compression for Range requests per RFC requirements, ensuring byte offsets correspond to uncompressed representations.
- **Proxy Caching (`Vary`)**: Emits `Vary: Accept-Encoding` so intermediate caches never conflate compressed and uncompressed representations.

---

## 2. Test Cases and Verification

### Test Case 1: Gzip Compression (`curl --compressed`)

**Action**: Request root endpoint `/` with `curl --compressed` (`Accept-Encoding: gzip, deflate, br, zstd`).

Client Command:
```bash
curl -i -s --compressed http://127.0.0.1:1234/
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Vary: Accept-Encoding
Content-Encoding: gzip
Transfer-Encoding: chunked

hello world.
```

**Result**: **PASS** (Server responds with `Content-Encoding: gzip`, `Transfer-Encoding: chunked`, and `Vary: Accept-Encoding`; client transparently decompresses body).

---

### Test Case 2: Deflate Compression on Static File

**Action**: Request `/files/package.json` with `Accept-Encoding: deflate`.

Client Command:
```bash
curl -i -s -H "Accept-Encoding: deflate" --compressed http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 200 OK
Content-Type: application/json
Accept-Ranges: bytes
Last-Modified: Tue, 03 Nov 2026 11:18:50 GMT
Cache-Control: public, max-age=3600
Vary: Accept-Encoding
Content-Encoding: deflate
Transfer-Encoding: chunked

{
  "name": "build-your-own-web-server-node",
  ...
}
```

**Result**: **PASS** (Server compresses file using `deflate` on the fly).

---

### Test Case 3: Range Request with Accept-Encoding (Compression Disabled)

**Action**: Request a partial range while offering `Accept-Encoding: gzip`.

Client Command:
```bash
curl -i -s -H "Accept-Encoding: gzip" -r 0-9 http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 206 Partial Content
Content-Type: application/json
Accept-Ranges: bytes
Last-Modified: Tue, 03 Nov 2026 11:18:50 GMT
Cache-Control: public, max-age=3600
Content-Range: bytes 0-9/1096
Vary: Accept-Encoding
Content-Length: 10

{
  "name"
```

**Result**: **PASS** (Compression skipped; byte range is served directly from the uncompressed file).
