// a custom error for HTTP status codes and aborting requests
export class HTTPError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, HTTPError.prototype);
  }
}

// an interface for reading/writing data from/to the HTTP body.
export type BodyReader = {
  // the "Content-Length", -1 if unknown.
  length: number;
  // read data. returns an empty buffer after EOF.
  read: () => Promise<Buffer>;
};

// Async generator type for byte buffers
export type BufferGenerator = AsyncGenerator<Buffer, void, void>;

// a parsed HTTP request header
export type HTTPReq = {
  method: string;
  uri: Buffer;
  version: string;
  headers: Buffer[];
};

// an HTTP response
export type HTTPRes = {
  code: number;
  headers: Buffer[];
  body: BodyReader;
};

// Standard HTTP status reasons
export const HTTP_STATUS_TEXT: Record<number, string> = {
  200: "OK",
  204: "No Content",
  206: "Partial Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  413: "Payload Too Large",
  416: "Range Not Satisfiable",
  500: "Internal Server Error",
  501: "Not Implemented",
};
