# Build Your Own Web Server from Scratch in Node.js

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Site-2ea44f?style=flat-square&logo=github&logoColor=white)](https://faiyazkhan024.github.io/build-your-own-web-server-node/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20runtime-blueviolet?style=flat-square)](#zero-runtime-dependencies)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

> **Live Documentation & Project Site**: [https://faiyazkhan024.github.io/build-your-own-web-server-node/](https://faiyazkhan024.github.io/build-your-own-web-server-node/)  
> **Source Repository**: [https://github.com/faiyazkhan024/build-your-own-web-server-node](https://github.com/faiyazkhan024/build-your-own-web-server-node)

A comprehensive hands-on implementation project based on the book **"Build Your Own Web Server from Scratch in Node.js"** by **James Smith** ([build-your-own.org](https://build-your-own.org)).

This project guides you through building a production-ready HTTP/1.1 and WebSocket server entirely from scratch using Node.js and TypeScript, with **zero runtime dependencies**. Rather than relying on high-level frameworks (such as Express, Fastify, or Node's built-in `http` module), everything—from raw TCP socket management, byte-stream protocol delimitation, and dynamic buffer reallocation, to chunked transfer encoding, static file streaming, HTTP caching, compression transformations, and concurrent WebSocket queues—is engineered directly on top of Node's low-level TCP socket primitives (`net` module).

---

## Table of Contents

- [Overview and Philosophy](#overview-and-philosophy)
  - [Zero Runtime Dependencies](#zero-runtime-dependencies)
  - [System Architecture](#system-architecture)
- [Chapter Roadmap and Status](#chapter-roadmap-and-status)
- [Book Structure and Chapters](#book-structure-and-chapters)
  - [01. Introduction](#01-introduction)
  - [02. HTTP Overview](#02-http-overview)
  - [03. Code A TCP Server](#03-code-a-tcp-server)
  - [04. Promises and Events](#04-promises-and-events)
  - [05. A Simple Network Protocol](#05-a-simple-network-protocol)
  - [06. HTTP Semantics and Syntax](#06-http-semantics-and-syntax)
  - [07. Code A Basic HTTP Server](#07-code-a-basic-http-server)
  - [08. Dynamic Content and Streaming](#08-dynamic-content-and-streaming)
  - [09. File IO & Resource Management](#09-file-io--resource-management)
  - [10. Range Requests](#10-range-requests)
  - [11. HTTP Caching](#11-http-caching)
  - [12. Compression & the Stream API](#12-compression--the-stream-api)
  - [13. WebSocket & Concurrency](#13-websocket--concurrency)
- [Project Setup](#project-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Build and Run](#build-and-run)
  - [Compile TypeScript](#compile-typescript)
  - [Run with Source Maps](#run-with-source-maps)
- [Testing Instructions](#testing-instructions)
  - [1. Testing with Netcat (`nc`)](#1-testing-with-netcat-nc)
  - [2. Testing with `socat`](#2-testing-with-socat)
  - [3. Testing with `curl`](#3-testing-with-curl)
  - [4. TLS / HTTPS Inspection (`openssl s_client`)](#4-tls--https-inspection-openssl-s_client)
- [Author](#author)
- [License](#license)

---

## Overview and Philosophy

The project follows a step-by-step, project-centric approach where each chapter builds on foundational networking principles:

1. **TCP Echo Server**: Socket primitives, event loop concurrency, and transitioning from callback events to `async`/`await` promises.
2. **Custom Network Protocol**: Handling stream-based data, byte delimiters, dynamic buffer allocation, and pipelined requests.
3. **HTTP/1.1 Protocol**: Parsing requests, headers, status lines, body readers, and chunked transfer encoding.
4. **Core Server Features**: Serving disk files safely without resource leaks, HTTP range requests, and cache validators (`ETag`, `Last-Modified`).
5. **Node.js Streams & Compression**: Integrating Node.js `stream.Transform`, gzip/deflate compression, and backpressure management.
6. **WebSockets & Concurrency**: Handshake upgrade, WebSocket framing, and thread/event concurrency using blocking queues.

### Zero Runtime Dependencies

This repository maintains strictly **zero runtime dependencies** (`"dependencies": {}`). Only development tools (`typescript` and `@types/node`) are used for type safety and compilation. Every protocol parser, buffer manager, and frame serializer is implemented directly from the ground up using Node's standard library primitives (`net`, `fs`, `zlib`, `crypto`).

### System Architecture

The following diagram outlines the layered architecture constructed throughout the book:

```text
+-------------------------------------------------------------------------+
|                           Application Layer                             |
|  +--------------------+  +----------------------+  +-----------------+  |
|  | Static File Server |  | Chunked Data Stream  |  | WebSocket App   |  |
|  | (MIME, Range, ETag)|  | (Async Generators)   |  | (Blocking Queue)|  |
|  +--------------------+  +----------------------+  +-----------------+  |
+-------------------------------------------------------------------------+
|                        Transformation & Encoding                        |
|  +-------------------------------------------------------------------+  |
|  | Compression Filter: gzip / deflate (Node.js Stream Transform API) |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
|                        HTTP / WebSocket Framing                         |
|  +-------------------------------------+  +--------------------------+  |
|  | HTTP/1.1 Parser & Serializer        |  | WebSocket Frame Parser   |  |
|  | (Headers, Status, Chunked Encoding) |  | (Opcodes, Masking, EOF)  |  |
|  +-------------------------------------+  +--------------------------+  |
+-------------------------------------------------------------------------+
|                         Network Protocol Layer                          |
|  +-------------------------------------------------------------------+  |
|  | Dynamic Buffer Manager (Growth, Slicing, Compaction, Pipelining)  |  |
|  | Promise-Based Socket Wrapper (async/await I/O, EOF & Half-Open)   |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
|                         Operating System Layer                          |
|  +-------------------------------------------------------------------+  |
|  | Raw TCP Sockets via Node.js 'net' module (IP packets & ByteStream)|  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

[↑ Back to top](#table-of-contents)

---

## Chapter Roadmap and Status

| Chapter | Title                         | Key Technical Concepts                                    | Status |
| :-----: | :---------------------------- | :-------------------------------------------------------- | :----: |
|   01    | Introduction                  | Project philosophy, book outline, zero-dependency setup   |  Done  |
|   02    | HTTP Overview                 | Protocol evolution, request/response cycle, CLI tools     | Ready  |
|   03    | Code A TCP Server             | Raw socket handles, listen/accept, byte stream vs packets | Ready  |
|   04    | Promises and Events           | Wrapping socket events into `async`/`await`, backpressure | Ready  |
|   05    | A Simple Network Protocol     | Dynamic buffers, length-prefixed messages, pipelining     | Ready  |
|   06    | HTTP Semantics and Syntax     | HTTP/1.1 grammar, CRLF delimiters, header rules           | Ready  |
|   07    | Code A Basic HTTP Server      | Request parsing, response dispatching, BufferedWriter     | Ready  |
|   08    | Dynamic Content and Streaming | Chunked transfer encoding, JavaScript async generators    | Ready  |
|   09    | File IO & Resource Management | Safe file reads, MIME types, preventing descriptor leaks  | Ready  |
|   10    | Range Requests                | Byte ranges (`206 Partial Content`), multi-range parsing  | Ready  |
|   11    | HTTP Caching                  | Conditional requests, `ETag`, `If-Modified-Since`, `304`  | Ready  |
|   12    | Compression & Stream API      | Gzip/deflate pipeline, Transform streams, highWaterMark   | Ready  |
|   13    | WebSocket & Concurrency       | HTTP upgrade handshake, frame decoding, blocking queue    | Ready  |

[↑ Back to top](#table-of-contents)

---

## Book Structure and Chapters

### 01. Introduction

- **1.1** Why Code a Web Server?
- **1.2** Build Your Own X From Scratch
- **1.3** The Book

### 02. HTTP Overview

- **2.1** Overview
- **2.2** HTTP by Example
- **2.3** The Evolution of HTTP (HTTP/1.0, HTTP/1.1, HTTP/2, HTTP/3)
- **2.4** Command Line Tools (`nc`, `socat`, `curl`)

### 03. Code A TCP Server

- **3.1** TCP Quick Review (Byte streams vs. packet boundaries, handshakes)
- **3.2** Socket Primitives (Listening sockets vs. connection sockets, EOF)
- **3.3** Socket API in Node.js (`net.createServer`, echo server)
- **3.4** Discussion: Half-Open Connections
- **3.5** Discussion: The Event Loop & Concurrency
- **3.6** Discussion: Asynchronous vs. Synchronous
- **3.7** Discussion: Promise-Based IO

### 04. Promises and Events

- **4.1** Introduction to `async` and `await`
- **4.2** Understanding `async` and `await`
- **4.3** From Events To Promises (Wrapping socket callbacks into promises)
- **4.4** Using `async` and `await`
- **4.5** Discussion: Backpressure
- **4.6** Discussion: Events and Ordered Execution
- **4.7** Conclusion: Promise vs. Callback

### 05. A Simple Network Protocol

- **5.1** Message Echo Server
- **5.2** Dynamic Buffers (Growing buffers, slicing, and memory management)
- **5.3** Implementing a Message Protocol
- **5.4** Discussion: Pipelined Requests
- **5.5** Discussion: Smarter Buffers
- **5.6** Conclusion: Network Programming Basics

### 06. HTTP Semantics and Syntax

- **6.1** High-Level Structures
- **6.2** Content-Length
- **6.3** Chunked Transfer Encoding
- **6.4** Ambiguities in HTTP
- **6.5** HTTP Message Format (Request line, headers, CRLF delimiter)
- **6.6** Common Header Fields
- **6.7** HTTP Methods
- **6.8** Discussion: Text vs. Binary
- **6.9** Discussion: Delimiters

### 07. Code A Basic HTTP Server

- **7.1** Start Coding (Request parsing, response generation)
- **7.2** Testing (Handling persistent connections and pipelining)
- **7.3** Discussion: Nagle's Algorithm
- **7.4** Discussion: BufferedWriter

### 08. Dynamic Content and Streaming

- **08.1** Chunked Transfer Encoding
- **08.2** Generating Chunked Responses
- **08.3** JS Generators (`function*` and async generators)
- **08.4** Reading Chunked Requests
- **08.5** Discussion: Debugging with Packet Capture Tools
- **08.6** Discussion: WebSocket

### 09. File IO & Resource Management

- **09.1** File IO in Node.js (`fs.promises`, file descriptors)
- **09.2** Serving Disk Files (MIME types, path traversal security)
- **09.3** Discussion: Manual Resource Management (Ensuring file handles close)
- **09.4** Discussion: Reusing Buffers

### 10. Range Requests

- **10.1** How Range Requests Work (`Range: bytes=...`, `206 Partial Content`)
- **10.2** Implementing Range Requests

### 11. HTTP Caching

- **11.1** Cache Validator (`If-None-Match`, `ETag`, `If-Modified-Since`, `304 Not Modified`)
- **11.2** Discussion: Server-Side Cache Control

### 12. Compression & the Stream API

- **12.1** How HTTP Compression Works (`Accept-Encoding`, `Content-Encoding`)
- **12.2** Data Processing with Pipes
- **12.3** Exploring the Stream API in Node.js
- **12.4** Implementing HTTP Compression (`zlib.createGzip()`, `zlib.createDeflate()`)
- **12.5** Discussion: Refactoring to Stream
- **12.6** Discussion: High Water Mark and Backpressure

### 13. WebSocket & Concurrency

- **13.1** Establishing WebSockets (Handshake upgrade: `101 Switching Protocols`, `Sec-WebSocket-Key`)
- **13.2** WebSocket Protocol (Frame headers, masking, opcodes, payload lengths)
- **13.3** Introduction to Concurrent Programming
- **13.4** Coding a Blocking Queue
- **13.5** WebSocket Server
- **13.6** Discussion: WebSocket in the Browser
- **13.7** Conclusion: What We Have Learned

[↑ Back to top](#table-of-contents)

---

## Project Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ or later recommended, LTS)
- npm (v9+ or later)

### Installation

Clone the repository and install devDependencies:

```bash
git clone git@github.com:faiyazkhan024/build-your-own-web-server-node.git
cd build-your-own-web-server-node
npm install
```

---

## Build and Run

### Compile TypeScript

Compile TypeScript files in `src/` to JavaScript with source maps in `dist/`:

```bash
npm run build
```

To watch for changes during development:

```bash
npm run watch
```

### Run with Source Maps

Run the compiled JavaScript while enabling Node's built-in source map support for readable stack traces:

```bash
npm start
# or directly:
node --enable-source-maps dist/index.js
```

[↑ Back to top](#table-of-contents)

---

## Testing Instructions

As detailed in Chapter 2.4 and throughout the book, network servers are tested using standard command-line tools:

### 1. Testing with Netcat (`nc`)

`nc` is the standard tool for sending raw bytes over TCP connections.

- **Connect to a TCP echo server:**

  ```bash
  nc 127.0.0.1 1234
  ```

  Type messages and press Enter; the echo server should reply with identical data.

- **Send a raw HTTP request:**

  ```bash
  printf "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | nc 127.0.0.1 1234
  ```

- **Test multiple requests on a persistent connection (HTTP/1.1):**

  ```bash
  printf "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\nGET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | nc 127.0.0.1 1234
  ```

### 2. Testing with `socat`

Some platforms and implementations of `nc` have quirks, such as not terminating on EOF or differing flag behaviors across BSD and GNU versions. `socat` provides consistent behavior:

- **Connect to TCP server via standard I/O:**

  ```bash
  socat - TCP:127.0.0.1:1234
  ```

- **Send input and close write side (half-close / EOF):**

  ```bash
  echo "Hello Server" | socat - TCP:127.0.0.1:1234
  ```

### 3. Testing with `curl`

`curl` is used for high-level HTTP client verification:

- **Basic GET request with full verbosity:**

  ```bash
  curl -vvv http://127.0.0.1:1234/
  ```

- **Inspect response headers only:**

  ```bash
  curl -i http://127.0.0.1:1234/
  ```

- **Test POST request with payload:**

  ```bash
  curl -v -X POST -d "sample body data" http://127.0.0.1:1234/echo
  ```

- **Test Range Requests (Chapter 10):**

  ```bash
  curl -v -H "Range: bytes=0-49" http://127.0.0.1:1234/file.txt
  ```

- **Test Caching Validators (Chapter 11):**

  ```bash
  curl -v -H 'If-None-Match: "etag-value"' http://127.0.0.1:1234/file.txt
  ```

- **Test HTTP Compression (Chapter 12):**

  ```bash
  curl -v --compressed -H "Accept-Encoding: gzip, deflate" http://127.0.0.1:1234/
  ```

### 4. TLS / HTTPS Inspection (`openssl s_client`)

When testing TLS/HTTPS connections (as discussed in Section 2.4):

```bash
openssl s_client -verify_quiet -quiet -connect 127.0.0.1:443
```

[↑ Back to top](#table-of-contents)

---

## Author

- **Faiyaz Khan** – [faiyazkhan024@gmail.com](mailto:faiyazkhan024@gmail.com) – GitHub: [@faiyazkhan024](https://github.com/faiyazkhan024)

---

## License

This project is licensed under the [MIT License](LICENSE).
