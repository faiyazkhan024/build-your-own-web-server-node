# Test Results: Chapter 03 – Step 6: Test It

- **Date**: 2026-11-03
- **Component**: TCP Echo Server (`src/index.ts` -> `dist/index.js`)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tool**: OpenBSD Netcat (`nc`)

---

## 1. Test Execution Overview

The TCP echo server was compiled and launched using:

```bash
npm run build
node --enable-source-maps dist/index.js
```

The server successfully bound to `127.0.0.1:1234` and listened for incoming TCP connections.

---

## 2. Test Cases and Verification

### Test Case 1: Standard Echo Response

**Action**: Send plain text payload and await echo response.

Client Command:

```bash
echo -n "Hello, TCP Echo Server!" | nc -N 127.0.0.1 1234
```

Client Output:

```text
Hello, TCP Echo Server!
```

Server Log:

```text
new connection 127.0.0.1 53434
data: <Buffer 48 65 6c 6c 6f 2c 20 54 43 50 20 45 63 68 6f 20 53 65 72 76 65 72 21>
EOF.
```

**Result**: **PASS** (exact byte sequence echoed back).

---

### Test Case 2: Multi-line / Consecutive Write Stream

**Action**: Send multiple lines to test stream handling.

Client Command:

```bash
printf "Packet 1\nPacket 2\n" | nc -N 127.0.0.1 1234
```

Client Output:

```text
Packet 1
Packet 2
```

Server Log:

```text
new connection 127.0.0.1 53448
data: <Buffer 50 61 63 6b 65 74 20 31 0a 50 61 63 6b 65 74 20 32 0a>
EOF.
```

**Result**: **PASS** (stream preservation verified).

---

### Test Case 3: Active Connection Close on "q"

**Action**: Send payload containing `"q"` to verify active termination via `socket.end()`.

Client Command:

```bash
echo -n "quit" | nc 127.0.0.1 1234
```

Client Output:

```text
quit
```

Server Log:

```text
new connection 127.0.0.1 53450
data: <Buffer 71 75 69 74>
closing connection
EOF.
```

**Result**: **PASS** (server detected character `'q'`, logged `"closing connection"`, and terminated the connection with FIN).

---

### Test Case 4: Client-Initiated Half-Close / EOF

**Action**: Send EOF from client and verify server-side `end` event.

Client Command:

```bash
echo -n "test eof" | nc -N 127.0.0.1 1234
```

Client Output:

```text
test eof
```

Server Log:

```text
new connection 127.0.0.1 53460
data: <Buffer 74 65 73 74 20 65 6f 66>
EOF.
```

**Result**: **PASS** (server received FIN and cleanly triggered the `"end"` callback).

---

## 3. Summary

All 4 test scenarios specified in Chapter 3.3 (Step 6) passed with zero errors. The TCP server fulfills all echo, termination, and error handling specifications.
