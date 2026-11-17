import {
  HTTPReq,
  HTTPRes,
  BodyReader,
  BufferGenerator,
  readerFromMemory,
  readerFromGenerator,
} from "../http-protocol";
import { serveStaticFile } from "../static-files";

// Sample generator: count to 10
export async function* countSheep(max: number = 10): BufferGenerator {
  for (let i = 0; i < max; i++) {
    // delay slightly then yield counter
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield Buffer.from(`${i}\n`);
  }
}

// A sample request handler
export async function handleReq(
  req: HTTPReq,
  body: BodyReader
): Promise<HTTPRes> {
  const uri = req.uri.toString("latin1");

  if (uri.startsWith("/files/")) {
    // Serve static disk files from the project workspace
    const relPath = uri.substring("/files/".length);
    return await serveStaticFile(relPath);
  }

  let resp: BodyReader;
  switch (uri) {
    case "/echo":
      // HTTP echo endpoint
      resp = body;
      break;
    case "/sheep":
      // Dynamic chunked streaming response
      resp = readerFromGenerator(countSheep(10));
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
