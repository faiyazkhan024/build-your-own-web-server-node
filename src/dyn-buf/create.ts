import { DynBuf } from "./types";

export const createDynBuf = (initialCapacity: number = 0): DynBuf => {
  return {
    data: Buffer.alloc(initialCapacity),
    length: 0,
  };
};
