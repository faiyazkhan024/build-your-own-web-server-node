# Test Results: Chapter 11 – HTTP Caching

- **Date**: 2026-11-18
- **Component**: HTTP Caching & Conditional Validators (`src/http-protocol/syntax.ts`, `src/static-files/serve.ts`)
- **Specification**: RFC 9110 (Conditional Requests) & RFC 9111 (HTTP Caching)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: `curl`

---

## 1. Chapter Overview

Chapter 11 implements HTTP Caching mechanisms and conditional request validators:
- **Timestamp Validator (`Last-Modified`)**: Emits the file modification timestamp formatted as IMF-fixdate (RFC 9110) in HTTP responses.
- **Conditional Validation (`If-Modified-Since`)**: Compares client timestamp with server file `mtime`. Returns `304 Not Modified` with zero body payload when fresh.
- **Cache Directives (`Cache-Control`)**: Emits `public, max-age=3600` advising clients and proxies on cache retention.
- **Conditional Range Validator (`If-Range`)**: Guards range downloads; if the file was modified since the client's last chunk, ignores `Range` and sends the full `200 OK` representation.

---

## 2. Test Cases and Verification

### Test Case 1: Initial Static File Request with Cache Headers

**Action**: Request `/files/package.json` and inspect `Last-Modified` and `Cache-Control` response headers.

Client Command:
```bash
curl -i -s http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 200 OK
Content-Type: application/json
Accept-Ranges: bytes
Last-Modified: Tue, 03 Nov 2026 11:18:50 GMT
Cache-Control: public, max-age=3600
Content-Length: 1096

{
  "name": "build-your-own-web-server-node",
...
```

**Result**: **PASS** (Server issues `Last-Modified` and `Cache-Control: public, max-age=3600`).

---

### Test Case 2: Conditional Cache Hit (`304 Not Modified`)

**Action**: Send `If-Modified-Since` matching the current file modification timestamp.

Client Command:
```bash
curl -i -s -H "If-Modified-Since: Tue, 03 Nov 2026 11:18:50 GMT" http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 304 Not Modified
Last-Modified: Tue, 03 Nov 2026 11:18:50 GMT
Cache-Control: public, max-age=3600
Content-Length: 0
```

**Result**: **PASS** (Returns `304 Not Modified` with empty body, signaling client to reuse local cache).

---

### Test Case 3: Conditional Cache Miss (`200 OK`)

**Action**: Send an outdated timestamp in `If-Modified-Since`.

Client Command:
```bash
curl -i -s -H "If-Modified-Since: Sun, 01 Jan 2020 00:00:00 GMT" http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 200 OK
Content-Type: application/json
Accept-Ranges: bytes
Last-Modified: Tue, 03 Nov 2026 11:18:50 GMT
Cache-Control: public, max-age=3600
Content-Length: 1096
```

**Result**: **PASS** (File has newer modification timestamp; full representation returned).

---

### Test Case 4: Conditional Range Matching (`If-Range`)

**Action**: Issue a range request with matching `If-Range` header.

Client Command:
```bash
curl -i -s -H "If-Range: Tue, 03 Nov 2026 11:18:50 GMT" -r 0-9 http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 206 Partial Content
Content-Type: application/json
Accept-Ranges: bytes
Last-Modified: Tue, 03 Nov 2026 11:18:50 GMT
Cache-Control: public, max-age=3600
Content-Range: bytes 0-9/1096
Content-Length: 10

{
  "name"
```

**Result**: **PASS** (Timestamp matches; partial content `206` served).

---

### Test Case 5: Conditional Range Invalidation (`If-Range` Mismatch)

**Action**: Issue a range request with outdated `If-Range`.

Client Command:
```bash
curl -i -s -H "If-Range: Sun, 01 Jan 2020 00:00:00 GMT" -r 0-9 http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 200 OK
Content-Type: application/json
Accept-Ranges: bytes
Last-Modified: Tue, 03 Nov 2026 11:18:50 GMT
Cache-Control: public, max-age=3600
Content-Length: 1096
```

**Result**: **PASS** (File modified; `Range` header ignored and full file served).
