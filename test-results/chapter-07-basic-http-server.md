# Test Results: Chapter 07 – Code A Basic HTTP Server

- **Date**: 2026-11-16
- **Component**: Basic HTTP/1.1 Server (`src/index.ts` -> `dist/index.js`)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: `curl`, `nc` (Netcat)

---

## 1. Test Execution Overview

The basic HTTP server was built and executed:

```bash
npm run build
node --enable-source-maps dist/index.js
```

The server listens on `127.0.0.1:1234` and processes incoming HTTP/1.1 requests, handling header delimitation (`\r\n\r\n`), body stream reading, request dispatching, combined response serialization, and persistent connection keep-alive.

---

## 2. Test Cases and Verification

### Test Case 1: Standard GET Request (`/`)

**Action**: Send a standard `GET /` request via `curl` and inspect response headers and body.

Client Command:
```bash
curl -i -s http://127.0.0.1:1234/
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Content-Length: 13

hello world.
```

**Result**: **PASS** (Status `200 OK`, `Server` header, and exact body length match).

---

### Test Case 2: Echo POST Request (`/echo`)

**Action**: Send a POST request with payload body to `/echo` and verify stream echoing.

Client Command:
```bash
curl -i -s --data-binary "hello from curl" http://127.0.0.1:1234/echo
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Content-Length: 15

hello from curl
```

**Result**: **PASS** (Payload accurately echoed with identical Content-Length).

---

### Test Case 3: Pipelined Requests over Persistent Connection

**Action**: Send two HTTP/1.1 requests pipelined in a single TCP connection (`GET /` followed by `POST /echo`).

Client Command:
```bash
printf "GET / HTTP/1.1\r\nHost: localhost\r\n\r\nPOST /echo HTTP/1.1\r\nHost: localhost\r\nContent-Length: 9\r\n\r\npipelined" | nc -w 2 127.0.0.1 1234
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Content-Length: 13

hello world.
HTTP/1.1 200 OK
Server: my_first_http_server
Content-Length: 9

pipelined
```

**Result**: **PASS** (Both responses returned sequentially over single TCP connection without closing or desynchronization).

---

### Test Case 4: HTTP/1.0 Connection Close

**Action**: Send an `HTTP/1.0` request and verify server automatically closes the connection after responding.

Client Command:
```bash
printf "GET / HTTP/1.0\r\nHost: localhost\r\n\r\n" | nc -w 2 127.0.0.1 1234
```

Client Output:
```text
HTTP/1.1 200 OK
Server: my_first_http_server
Content-Length: 13

hello world.
```

**Result**: **PASS** (Connection terminates cleanly upon sending response).
