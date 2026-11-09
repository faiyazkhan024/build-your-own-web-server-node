import { DynBuf, bufPop } from "../dyn-buf";

export const cutMessage = (buf: DynBuf): null | Buffer => {
  // messages are separated by '\n'
  const idx = buf.data.subarray(0, buf.length).indexOf("\n");
  if (idx < 0) {
    return null; // not complete
  }
  // make a copy of the message and move the remaining data to the front
  const msg = Buffer.from(buf.data.subarray(0, idx + 1));
  bufPop(buf, idx + 1);
  return msg;
};
