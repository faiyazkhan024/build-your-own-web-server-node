# Test Results: Chapter 13 – WebSocket & Concurrency

- **Date**: 2026-11-19
- **Component**: WebSocket RFC 6455 Handshake, Frame Codec, Concurrent Server Tasks & Blocking Queue (`src/websocket/`, `src/http-server/server.ts`, `src/http-protocol/`)
- **Specification**: RFC 6455 (The WebSocket Protocol), RFC 9110 (101 Switching Protocols)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: Node.js Net client with RFC 6455 compliance test

---

## 1. Chapter Overview

Chapter 13 introduces full-duplex, asynchronous bidirectional communication and concurrency primitives to our web server:
- **Blocking Queue Primitive (`createQueue`)**: Multi-producer, multi-consumer asynchronous FIFO queue with capacity-based backpressure. Producers block when the queue exceeds capacity until consumers drain items.
- **RFC 6455 Frame Codec (`wsParseFrame`, `wsEncodeFrame`, `wsMask`)**:
  - Encodes and decodes WebSocket data frames (Opcode `0x1` text, `0x2` binary, `0x8` close, `0x9` ping, `0xA` pong).
  - Enforces mandatory client-to-server payload masking with 4-byte random XOR keys.
  - Generates `Sec-WebSocket-Accept` using SHA-1 and Base64 matching RFC 6455 magic GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`.
- **Concurrent Server Tasks (`wsServerRecv`, `wsServerSend`, `createWSServer`)**:
  - Independent concurrent tasks for receiving frames from the socket and sending outbound queued frames to the socket.
  - Bridges WebSocket streams seamlessly into `BodyReader` without violating the HTTP server's response lifecycle.
- **WebSocket Upgrade Integration**:
  - Recognizes `Upgrade: websocket` requests and routes to the WebSocket application (`echoWSApp`).
  - Emits `HTTP/1.1 101 Switching Protocols` response headers without `Content-Length` or `Transfer-Encoding: chunked`.
  - Streams raw byte frames without HTTP chunked wrapping (`raw = true`).

---

## 2. Test Cases and Verification

### Test Case 1: RFC 6455 Upgrade Handshake

**Action**: Send an HTTP upgrade request with `Upgrade: websocket` and `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==`.

Client Request:
```http
GET /ws HTTP/1.1
Host: 127.0.0.1:1234
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

Server Response:
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

**Result**: **PASS** (Server responds with `101 Switching Protocols` and the correctly hashed `Sec-WebSocket-Accept` header; socket connection upgraded without closing).

---

### Test Case 2: Masked Text Message Frame & Server Echo

**Action**: Client sends a masked text frame (Opcode `0x1`) containing `"Hello WebSocket!"`.

- Client Frame Header: `0x81` (FIN=1, Opcode=1), `0x90` (Mask=1, Len=16)
- Client Mask Key: `[0x9a, 0x14, 0x5f, 0x82]`
- Server Echo Header: `0x81 0x10` (FIN=1, Opcode=1, Mask=0, Len=16)
- Server Echo Body: `"Hello WebSocket!"`

**Result**: **PASS** (Server successfully unmasks client frame, routes message through `echoWSApp`, and emits unmasked server-to-client frame with identical payload).

---

### Test Case 3: Masked Binary Message Frame & Server Echo

**Action**: Client sends a masked binary frame (Opcode `0x2`) with payload bytes `<0xDE, 0xAD, 0xBE, 0xEF>`.

- Client Frame Header: `0x82` (FIN=1, Opcode=2), `0x84` (Mask=1, Len=4)
- Server Echo Header: `0x82 0x04` (FIN=1, Opcode=2, Mask=0, Len=4)
- Server Echo Body: `<Buffer de ad be ef>`

**Result**: **PASS** (Binary payload preserved byte-for-byte across the WebSocket frame transport).

---

### Test Case 4: WebSocket Connection Close (Opcode 0x8)

**Action**: Client sends a close frame (Opcode `0x8`) with length 0.

- Client Close Frame: `0x88 0x80` + 4-byte mask
- Server Response: `0x88 0x00` (Opcode=8, Mask=0, Len=0)

**Result**: **PASS** (Server acknowledges close handshake and gracefully terminates TCP connection).

---

## 3. Summary

All 4 test scenarios passed completely. The HTTP server now supports full bidirectional RFC 6455 WebSocket communication seamlessly alongside traditional HTTP/1.1 dynamic and static file requests.
