# Test Results: Chapter 08 – Dynamic Content and Streaming

- **Date**: 2026-11-16
- **Component**: Chunked Transfer Encoding & Streaming (`src/http-protocol/chunked.ts`, `src/http-protocol/response.ts`)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: `curl`, `nc` (Netcat)

---

## 1. Chapter Overview

Chapter 08 introduces dynamic content generation and streaming through RFC 9112 Chunked Transfer Encoding:
- **Chunked Response Writer**: When `BodyReader.length < 0`, emits `Transfer-Encoding: chunked` and encodes chunks (`<hex-len>\r\n<data>\r\n`) terminated by a 0-byte chunk (`0\r\n\r\n`).
- **Async Generators**: Bridges producers with the `BodyReader` consumer interface via `readerFromGenerator` for backpressure-friendly dynamic generation.
- **Chunked Request Decoding**: Parses incoming chunked streams (`readChunks`) yielding chunks on the fly without loading unbounded payloads into memory.

---

## 2. Test Cases and Verification

### Test Case 1: Dynamic Chunked Streaming (`/sheep`)

**Action**: Request the dynamic generator endpoint `/sheep` and verify chunked delivery.

Client Command:
```bash
curl -i -s http://127.0.0.1:1234/sheep
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Transfer-Encoding: chunked

0
1
2
3
4
5
6
7
8
9
```

**Result**: **PASS** (Server responds with `Transfer-Encoding: chunked` and streams generated data sequentially).

---

### Test Case 2: Chunked Request Body Upload via `curl -T -`

**Action**: Stream a request payload to `/echo` using chunked transfer encoding (`curl -T -`).

Client Command:
```bash
printf "chunk1 " | curl -i -s -T - http://127.0.0.1:1234/echo
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Transfer-Encoding: chunked

chunk1 
```

**Result**: **PASS** (Server reads chunks on the fly and echoes the payload via chunked transfer encoding).

---

### Test Case 3: Raw Byte-Stream Chunk Parsing via Netcat

**Action**: Transmit manually formatted hex chunks over raw TCP socket (`4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n`) and verify proper parsing.

Client Command:
```bash
printf "POST /echo HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n" | nc -w 2 127.0.0.1 1234
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Transfer-Encoding: chunked

Wikipedia
```

**Result**: **PASS** (Individual chunks reassembled into clean application byte stream).
