import { HTTPReq, HTTPRes, BodyReader, fieldGet } from "../http-protocol";
import { WSServer, WSApplication, createWSServer, sendText } from "./server";
import { wsKeyAccept, WS_DATA_TEXT, WS_DATA_BINARY } from "./frame";

// Sample WebSocket application: Echo server
export async function echoWSApp(ws: WSServer): Promise<void> {
  while (true) {
    const msg = await ws.recv();
    if (!msg) break;

    const chunks: Buffer[] = [];
    while (true) {
      const c = await msg.read();
      if (c.length === 0) break;
      chunks.push(c);
    }
    const data = Buffer.concat(chunks);

    // Echo the data back to client
    let done = false;
    await ws.send({
      type: msg.type,
      length: data.length,
      read: async () => {
        if (done) return Buffer.from("");
        done = true;
        return data;
      },
    });
  }
}

// Handle WebSocket upgrade handshake
export async function handleWS(
  req: HTTPReq,
  reqBody: BodyReader,
  app: WSApplication
): Promise<HTTPRes> {
  // Handle the WS protocol and tasks
  const [ws, resBody] = createWSServer(reqBody);

  // Launch the WS application concurrently without awaiting it
  app(ws)
    .finally(() => ws.close())
    .catch((err) => {
      console.error("WS application error:", err);
    });

  // Calculate the Sec-WebSocket-Accept key
  const key = fieldGet(req.headers, "Sec-WebSocket-Key") || Buffer.from("");
  const acceptKey = wsKeyAccept(key);

  return {
    code: 101, // Switching Protocols
    headers: [
      Buffer.from("Upgrade: websocket"),
      Buffer.from("Connection: Upgrade"),
      Buffer.from(`Sec-WebSocket-Accept: ${acceptKey}`),
    ],
    body: resBody,
  };
}

// Check if request is a WebSocket upgrade request
export function getWSApp(req: HTTPReq): null | WSApplication {
  const upgrade = fieldGet(req.headers, "Upgrade");
  if (
    upgrade &&
    upgrade.toString("latin1").toLowerCase().includes("websocket")
  ) {
    return echoWSApp;
  }
  const uri = req.uri.toString("latin1");
  if (uri === "/ws" || uri === "/chat") {
    return echoWSApp;
  }
  return null;
}
