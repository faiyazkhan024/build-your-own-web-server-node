# Test Results: Chapter 05 – A Simple Network Protocol

- **Date**: 2026-11-09
- **Component**: Simple Message Protocol Server (`src/index.ts` -> `dist/index.js`)
- **Host / Port**: `127.0.0.1:1234`
- **Runner**: Node.js v26.13.0 with `--enable-source-maps`
- **Testing Tools**: Netcat (`nc`), Python 3 TCP socket client

---

## 1. Test Execution Overview

The message echo server was compiled and launched using:

```bash
npm run build
node --enable-source-maps dist/index.js
```

The server bound to `127.0.0.1:1234` and accepted incoming TCP connections, implementing the newline-delimited message protocol over dynamic buffers (`DynBuf`).

---

## 2. Test Cases and Verification

### Test Case 1: Standard Single Message Echo

**Action**: Send a single message ending with `\n` and verify the `Echo:` prefix is prepended.

Client Command:

```bash
printf "hello\n" | nc -w 2 127.0.0.1 1234
```

Client Output:

```text
Echo:hello
```

Server Log:

```text
new connection 127.0.0.1 58234
```

**Result**: **PASS** (prefixed message echoed back correctly).

---

### Test Case 2: Sequential Messages

**Action**: Send multiple newline-terminated messages in sequence over a single connection.

Client Command:

```bash
printf "msg1\nmsg2\n" | nc -w 2 127.0.0.1 1234
```

Client Output:

```text
Echo:msg1
Echo:msg2
```

Server Log:

```text
new connection 127.0.0.1 58238
```

**Result**: **PASS** (both messages successfully parsed and echoed in order).

---

### Test Case 3: Quit Command and Connection Termination

**Action**: Send `"quit\n"` command and verify the server replies with `"Bye.\n"` and terminates the socket connection.

Client Command:

```bash
printf "quit\n" | nc -w 2 127.0.0.1 1234
```

Client Output:

```text
Bye.
```

Server Log:

```text
new connection 127.0.0.1 58252
```

**Result**: **PASS** (server sends `Bye.\n` and actively destroys socket).

---

### Test Case 4: Multiple Messages Followed by Quit

**Action**: Send several echo requests followed immediately by a `quit` instruction.

Client Command:

```bash
printf "first\nsecond\nquit\n" | nc -w 2 127.0.0.1 1234
```

Client Output:

```text
Echo:first
Echo:second
Bye.
```

Server Log:

```text
new connection 127.0.0.1 58262
```

**Result**: **PASS** (all messages processed before connection teardown).

---

### Test Case 5: Pipelined Requests in a Single TCP Chunk

**Action**: Transmit multiple messages (`"asdf\n1234\n"`) within a single TCP write to verify dynamic buffer preservation, message boundary splitting, and pipelined request handling.

Client Script:

```python
import socket
s = socket.socket()
s.connect(("127.0.0.1", 1234))
s.sendall(b"asdf\n1234\n")
res = b""
while len(res) < len(b"Echo:asdf\nEcho:1234\n"):
    chunk = s.recv(1024)
    if not chunk:
        break
    res += chunk
print("Pipelined response:", repr(res.decode()))
s.close()
```

Client Output:

```text
Pipelined response: 'Echo:asdf\nEcho:1234\n'
```

Server Log:

```text
new connection 127.0.0.1 58274
```

**Result**: **PASS** (server does not assume socket read matches message boundary; buffers and slices messages independently).
