import { BodyReader } from "../http-protocol";
import { DynBuf, createDynBuf, bufPush, bufPop } from "../dyn-buf";
import { Queue, createQueue } from "./queue";
import {
  WS_DATA_TEXT,
  WS_DATA_BINARY,
  WS_OP_CONTINUE,
  WS_CTRL_CLOSE,
  WS_CTRL_PING,
  WS_CTRL_PONG,
  parseWSFrameHeader,
  unmaskPayload,
  encodeWSFrame,
} from "./frame";

// WebSocket message interface
export type WSMsg = {
  type: number; // WS_DATA_TEXT or WS_DATA_BINARY
  length: number; // in bytes; -1 if unknown/fragmented
  read: () => Promise<Buffer>; // empty after EOF
};

// Application interface for WebSocket
export type WSServer = {
  send(msg: WSMsg): Promise<void>;
  recv(): Promise<null | WSMsg>;
  close(): void;
};

export type WSApplication = (ws: WSServer) => Promise<void>;

// Read from socket stream, parse frames, and feed messages to application
export async function wsServerRecv(
  reqBody: BodyReader,
  qrecv: Queue<WSMsg>,
  ws: WSServer
): Promise<void> {
  const buf: DynBuf = createDynBuf();
  let currentMsgQueue: null | Queue<Buffer> = null;
  let currentMsgType = WS_DATA_TEXT;

  try {
    while (true) {
      // 1. Ensure we have the frame header
      let header = parseWSFrameHeader(buf.data.subarray(0, buf.length));
      while (!header) {
        const chunk = await reqBody.read();
        if (chunk.length === 0) {
          return; // Normal connection end
        }
        bufPush(buf, chunk);
        header = parseWSFrameHeader(buf.data.subarray(0, buf.length));
      }

      // 2. Ensure we have the complete frame payload
      const totalFrameLen = header.headerLen + header.payloadLen;
      while (buf.length < totalFrameLen) {
        const chunk = await reqBody.read();
        if (chunk.length === 0) {
          throw new Error("unexpected EOF while reading WS frame payload");
        }
        bufPush(buf, chunk);
      }

      // Extract raw payload
      const rawPayload = buf.data.subarray(header.headerLen, totalFrameLen);
      // Unmask if masked
      const payload =
        header.masked && header.maskKey
          ? unmaskPayload(rawPayload, header.maskKey)
          : Buffer.from(rawPayload);

      bufPop(buf, totalFrameLen);

      // Handle control frames
      if (header.opcode === WS_CTRL_CLOSE) {
        ws.close();
        return;
      } else if (header.opcode === WS_CTRL_PING) {
        // Send pong frame
        let done = false;
        await ws.send({
          type: WS_CTRL_PONG,
          length: payload.length,
          read: async () => {
            if (done) return Buffer.from("");
            done = true;
            return payload;
          },
        });
        continue;
      } else if (header.opcode === WS_CTRL_PONG) {
        continue; // Heartbeat pong received
      }

      // Handle data frames (text, binary, continuation)
      if (header.opcode === WS_DATA_TEXT || header.opcode === WS_DATA_BINARY) {
        currentMsgType = header.opcode;
        currentMsgQueue = createQueue<Buffer>();
        const q = currentMsgQueue;
        const msg: WSMsg = {
          type: currentMsgType,
          length: header.fin ? payload.length : -1,
          read: async () => (await q.popFront()) || Buffer.from(""),
        };
        await qrecv.pushBack(msg);
        await q.pushBack(payload);
        if (header.fin) {
          q.close();
          currentMsgQueue = null;
        }
      } else if (header.opcode === WS_OP_CONTINUE) {
        if (!currentMsgQueue) {
          throw new Error("unexpected continuation frame");
        }
        await currentMsgQueue.pushBack(payload);
        if (header.fin) {
          currentMsgQueue.close();
          currentMsgQueue = null;
        }
      }
    }
  } finally {
    currentMsgQueue?.close();
  }
}

// Format WS messages and send them to the socket queue
export async function wsServerSend(
  qsend: Queue<WSMsg>,
  qsock: Queue<Buffer>
): Promise<void> {
  while (true) {
    const msg = await qsend.popFront();
    if (!msg) {
      // Send close frame
      const closeFrame = encodeWSFrame(WS_CTRL_CLOSE, Buffer.from(""));
      await qsock.pushBack(closeFrame);
      break;
    }

    if (msg.type === WS_CTRL_PONG) {
      const data = await msg.read();
      const pongFrame = encodeWSFrame(WS_CTRL_PONG, data);
      await qsock.pushBack(pongFrame);
      continue;
    }

    // Normal message: read all fragments / chunks and emit frame
    const chunks: Buffer[] = [];
    while (true) {
      const c = await msg.read();
      if (c.length === 0) break;
      chunks.push(c);
    }
    const fullPayload = Buffer.concat(chunks);
    const frame = encodeWSFrame(msg.type, fullPayload, true);
    await qsock.pushBack(frame);
  }
}

// Create a full-duplex WebSocket server instance
export function createWSServer(reqBody: BodyReader): [WSServer, BodyReader] {
  const qrecv: Queue<WSMsg> = createQueue<WSMsg>();
  const qsend: Queue<WSMsg> = createQueue<WSMsg>();

  const ws: WSServer = {
    send: (msg: WSMsg) => qsend.pushBack(msg),
    recv: () => qrecv.popFront(),
    close: (): void => {
      qsend.close();
      qrecv.close();
    },
  };

  // Task 1: reading from the socket
  wsServerRecv(reqBody, qrecv, ws)
    .finally(() => ws.close())
    .catch((err) => {
      console.error("wsServerRecv error:", err);
    });

  // Task 2: writing to the socket
  const qsock: Queue<Buffer> = createQueue<Buffer>();
  wsServerSend(qsend, qsock)
    .finally(() => ws.close())
    .finally(() => qsock.close())
    .catch((err) => {
      console.error("wsServerSend error:", err);
    });

  const resBody: BodyReader = {
    length: -1,
    read: async () => (await qsock.popFront()) || Buffer.from(""),
  };

  return [ws, resBody];
}

// Convenient helper to send a text message
export async function sendText(ws: WSServer, text: string): Promise<void> {
  const data = Buffer.from(text, "utf8");
  let done = false;
  await ws.send({
    type: WS_DATA_TEXT,
    length: data.length,
    read: async () => {
      if (done) return Buffer.from("");
      done = true;
      return data;
    },
  });
}
