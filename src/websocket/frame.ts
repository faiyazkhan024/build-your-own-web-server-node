import * as crypto from "crypto";

// RFC 6455 Opcodes
export const WS_OP_CONTINUE = 0x00;
export const WS_DATA_TEXT = 0x01;
export const WS_DATA_BINARY = 0x02;
export const WS_CTRL_CLOSE = 0x08;
export const WS_CTRL_PING = 0x09;
export const WS_CTRL_PONG = 0x0a;

// Calculate Sec-WebSocket-Accept from Sec-WebSocket-Key
export function wsKeyAccept(key: Buffer): string {
  return crypto
    .createHash("sha1")
    .update(key)
    .update("258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest()
    .toString("base64");
}

export type WSFrameHeader = {
  fin: boolean;
  opcode: number;
  masked: boolean;
  payloadLen: number;
  headerLen: number;
  maskKey: Buffer | null;
};

// Parse a WebSocket frame header from the beginning of buffer
export function parseWSFrameHeader(data: Buffer): WSFrameHeader | null {
  if (data.length < 2) return null;
  const byte0 = data[0];
  const byte1 = data[1];

  const fin = (byte0 & 0x80) !== 0;
  const opcode = byte0 & 0x0f;
  const masked = (byte1 & 0x80) !== 0;
  let payloadLen = byte1 & 0x7f;
  let headerLen = 2;

  if (payloadLen === 126) {
    if (data.length < headerLen + 2) return null;
    payloadLen = data.readUInt16BE(headerLen);
    headerLen += 2;
  } else if (payloadLen === 127) {
    if (data.length < headerLen + 8) return null;
    payloadLen = Number(data.readBigUInt64BE(headerLen));
    headerLen += 8;
  }

  let maskKey: Buffer | null = null;
  if (masked) {
    if (data.length < headerLen + 4) return null;
    maskKey = Buffer.from(data.subarray(headerLen, headerLen + 4));
    headerLen += 4;
  }

  return {
    fin,
    opcode,
    masked,
    payloadLen,
    headerLen,
    maskKey,
  };
}

// Unmask payload buffer in place with 4-byte XOR masking key
export function unmaskPayload(payload: Buffer, maskKey: Buffer): Buffer {
  const out = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i++) {
    out[i] = payload[i] ^ maskKey[i % 4];
  }
  return out;
}

// Encode a server-to-client frame (no masking required per RFC 6455)
export function encodeWSFrame(
  opcode: number,
  payload: Buffer,
  fin: boolean = true
): Buffer {
  let headerLen = 2;
  const len = payload.length;
  if (len <= 125) {
    // 2 bytes
  } else if (len <= 65535) {
    headerLen += 2;
  } else {
    headerLen += 8;
  }

  const header = Buffer.alloc(headerLen);
  header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  if (len <= 125) {
    header[1] = len;
  } else if (len <= 65535) {
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}
