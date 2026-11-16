import {
  HTTPReq,
  HTTPRes,
  BodyReader,
  readerFromMemory,
} from "../http-protocol";

// A sample request handler
export async function handleReq(
  req: HTTPReq,
  body: BodyReader
): Promise<HTTPRes> {
  let resp: BodyReader;
  const path = req.uri.toString("latin1");

  switch (path) {
    case "/echo":
      // HTTP echo endpoint
      resp = body;
      break;
    default:
      resp = readerFromMemory(Buffer.from("hello world.\n"));
      break;
  }

  return {
    code: 200,
    headers: [Buffer.from("Server: my_first_http_server")],
    body: resp,
  };
}
