# Test Results: Chapter 10 – Range Requests

- **Date**: 2026-11-17
- **Component**: Range Requests & Partial Content (`src/static-files/range.ts`, `src/static-files/serve.ts`, `src/http-server/server.ts`)
- **Specification**: RFC 9110 (Range Requests, 206 Partial Content, 416 Range Not Satisfiable, HEAD)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: `curl`

---

## 1. Chapter Overview

Chapter 10 implements HTTP Range Requests (`Range: bytes=...`) enabling resumable downloads:
- **Range Grammar & Effective Intersection**: Parses `int-range` (`first-last` or `first-`) and `suffix-range` (`-suffix`), calculating effective intersection `[start, end)` against total file size.
- **206 Partial Content**: Emits partial byte intervals with `Content-Range: bytes <start>-<end>/<total>` and exact `Content-Length`.
- **416 Range Not Satisfiable**: Handles out-of-range requests, returning `Content-Range: bytes */<total>`.
- **HEAD Method**: Returns response status and headers while omitting response body bytes to allow client capability probing without transmission overhead.

---

## 2. Test Cases and Verification

### Test Case 1: First 10 Bytes Interval (`Range: bytes=0-9`)

**Action**: Request the first 10 bytes of `package.json` with `curl -r 0-9`.

Client Command:
```bash
curl -i -s -r 0-9 http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 206 Partial Content
Content-Type: application/json
Accept-Ranges: bytes
Content-Range: bytes 0-9/1096
Content-Length: 10

{
  "name"
```

**Result**: **PASS** (Returned status 206, `Content-Range: bytes 0-9/1096`, and 10 bytes).

---

### Test Case 2: Suffix Range (`Range: bytes=-15`)

**Action**: Request the trailing 15 bytes of `package.json` with `curl -r -15`.

Client Command:
```bash
curl -i -s -r -15 http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 206 Partial Content
Content-Type: application/json
Accept-Ranges: bytes
Content-Range: bytes 1081-1095/1096
Content-Length: 15

"^5.7.3"
  }
}
```

**Result**: **PASS** (Correctly computed effective range `1081-1095/1096` and returned last 15 bytes).

---

### Test Case 3: Out-of-Bounds Range (`416 Range Not Satisfiable`)

**Action**: Request a byte range beyond the file length (`9999-99999`).

Client Command:
```bash
curl -i -s -r 9999-99999 http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 416 Range Not Satisfiable
Content-Type: text/plain; charset=utf-8
Content-Range: bytes */1096
Content-Length: 22

Range Not Satisfiable
```

**Result**: **PASS** (Status `416` with RFC-compliant `Content-Range: bytes */1096`).

---

### Test Case 4: HEAD Method Verification

**Action**: Send `HEAD` request via `curl -I` and confirm response body is omitted.

Client Command:
```bash
curl -I -s http://127.0.0.1:1234/files/package.json
```

Client Output:
```text
HTTP/1.1 200 OK
Content-Type: application/json
Accept-Ranges: bytes
Content-Length: 1096
```

**Result**: **PASS** (Headers sent with full content length, payload body completely omitted).
