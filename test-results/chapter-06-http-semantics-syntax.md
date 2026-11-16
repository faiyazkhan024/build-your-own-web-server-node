# Test Results: Chapter 06 – HTTP Semantics and Syntax

- **Date**: 2026-11-16
- **Component**: HTTP Semantics and Protocol Parser (`src/http-protocol/`)
- **Specification**: RFC 9110 (HTTP Semantics) & RFC 9112 (HTTP/1.1)
- **Runner**: Node.js v26.13.0 with TypeScript 5.7+

---

## 1. Chapter Overview

Chapter 06 establishes the core semantic rules, grammar, and security validations required for robust HTTP/1.1 communication:
- **Header Delimitation**: Lines separated by `\r\n` (CRLF), terminated with an empty line (`\r\n\r\n`).
- **Body Length Rules**: Resolving precedence between `Transfer-Encoding: chunked`, `Content-Length`, and close-delimited streams; preventing HTTP request smuggling.
- **Request Line Grammar**: Token validation for HTTP methods, URI buffers, and HTTP/1.0 vs HTTP/1.1 versioning.
- **Header Field Syntax**: Enforcing RFC 9112 `field-name ":" OWS field-value BWS`, disallowing internal CR/LF bytes to guard against HTTP response splitting.
- **Idempotence & Safety**: Classifying HTTP methods (`GET`, `HEAD`, `POST`, `PUT`, `DELETE`, etc.).

---

## 2. Test Execution & Verification

### Test Case 1: Line Splitting on CRLF Delimiters (`splitLines`)
- **Input**: `GET / HTTP/1.1\r\nHost: localhost\r\n\r\n`
- **Expected Output**:
  - `lines[0]`: `GET / HTTP/1.1`
  - `lines[1]`: `Host: localhost`
  - `lines[2]`: `""` (empty terminating line)
- **Result**: **PASS**

### Test Case 2: Request Line Grammar Validation (`parseRequestLine`)
- **Valid Input**: `POST /api/v1/resource HTTP/1.1`
  - Parsed method: `POST`
  - Parsed URI: `/api/v1/resource`
  - Parsed version: `1.1`
  - **Result**: **PASS**
- **Malformed Input**: Missing spaces, bad tokens, or unsupported versions throw `HTTPError(400)`.
  - **Result**: **PASS**

### Test Case 3: Header Field Validation & Anti-Splitting (`validateHeader`)
- **Valid Header**: `Content-Type: application/json` -> Valid (`true`)
- **Invalid Header (Whitespace in field name)**: `Bad Header: val` -> Rejected (`false`)
- **Invalid Header (No colon / empty name)**: `: no name` -> Rejected (`false`)
- **Attack Vector (CRLF injection / response splitting)**: `Header\r\nInjection: val` -> Rejected (`false`)
- **Result**: **PASS**

### Test Case 4: Case-Insensitive Header Lookup (`fieldGet`)
- Case-insensitively looks up `content-length` or `HOST` across byte buffer headers, stripping surrounding whitespace (`OWS`).
- **Result**: **PASS**

### Test Case 5: Safe Decimal Integer Parsing (`parseDec`)
- Parses strictly numeric integers for `Content-Length`.
- Non-digits or negative numbers return `NaN`.
- **Result**: **PASS**
