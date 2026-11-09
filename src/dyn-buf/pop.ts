import { DynBuf } from "./types";

// remove data from the front
export const bufPop = (buf: DynBuf, len: number): void => {
  buf.data.copyWithin(0, len, buf.length);
  buf.length -= len;
};
