# Test Results: Chapter 09 – File IO & Resource Management

- **Date**: 2026-11-16
- **Component**: Static File Serving, Resource Management & MIME (`src/static-files/`, `src/http-server/handler.ts`)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: `curl`

---

## 1. Chapter Overview

Chapter 09 implements disk file IO and resource lifecycle management for static content:
- **Asynchronous File Handles**: Uses `fs.promises.open('r')` and `fp.stat()` to prevent race conditions (Time-of-check to time-of-use / TOCTOU).
- **Ownership Transfer & Cleanup**: Transfers ownership of the open file handle from `serveStaticFile` to `BodyReader`, ensuring the handle is closed in `close()` without descriptor leaks.
- **Buffer Reuse**: Reuses preallocated 64KB buffers (`Buffer.allocUnsafe`) to amortize memory allocation and zeroing costs during sequential chunk reads.
- **Security & Path Traversal Prevention**: Sanitizes URL paths against `..` escaping and null bytes, rejecting directory traversal attempts with `403 Forbidden`.
- **MIME Type Mapping**: Detects file types by extension (`.json`, `.html`, `.txt`, `.pdf`, etc.) and sets `Content-Type`.

---

## 2. Test Cases and Verification

### Test Case 1: Serve JSON File (`/files/package.json`)

**Action**: Request project metadata file `/files/package.json` and verify headers and size.

Client Command:
```bash
curl -i -s http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 200 OK
Content-Type: application/json
Accept-Ranges: bytes
Content-Length: 1096

{
  "name": "build-your-own-web-server-node",
  ...
}
```

**Result**: **PASS** (Correct MIME type `application/json`, Content-Length 1096, and file payload streamed).

---

### Test Case 2: Serve Text / License File (`/files/LICENSE`)

**Action**: Request `/files/LICENSE` and verify static stream reading.

Client Command:
```bash
curl -i -s http://127.0.0.1:1234/files/LICENSE
```

Client Output:
```text
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Accept-Ranges: bytes
Content-Length: 1094

MIT License
...
```

**Result**: **PASS** (Correct status 200 and Content-Length 1094).

---

### Test Case 3: 404 For Missing File (`/files/missing.txt`)

**Action**: Request a non-existent file.

Client Command:
```bash
curl -i -s http://127.0.0.1:1234/files/missing.txt
```

Client Output:
```text
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 10

Not Found
```

**Result**: **PASS** (Returns `404 Not Found` with closed descriptor).

---

### Test Case 4: Path Traversal Attack Prevention

**Action**: Attempt path traversal with `..` via `curl --path-as-is`.

Client Command:
```bash
curl -i -s --path-as-is "http://127.0.0.1:1234/files/../etc/passwd"
```

Client Output:
```text
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 39

Access Denied: Path Traversal Detected
```

**Result**: **PASS** (Request denied with `403 Forbidden`).
