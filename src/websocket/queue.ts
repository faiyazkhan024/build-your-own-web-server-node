// Multi-producer, multi-consumer blocking queue with backpressure
export type Queue<T> = {
  pushBack(item: T): Promise<void>;
  popFront(): Promise<null | T>;
  close(): void;
};

type Taker<T> = (item: null | T) => void;
type Giver<T> = (take: Taker<T>) => void;
type Rejector = (err: Error) => void;

export function createQueue<T>(): Queue<T> {
  const producers: { give: Giver<T>; reject: Rejector }[] = [];
  const consumers: Taker<T>[] = [];
  let closed = false;

  return {
    pushBack: (item: T): Promise<void> => {
      return new Promise<void>((done, reject) => {
        if (closed) {
          return reject(new Error("queue closed."));
        }
        const give: Giver<T> = (take: Taker<T>) => {
          take(item);
          done();
        };
        if (consumers.length > 0) {
          const take = consumers.shift()!;
          give(take);
        } else {
          producers.push({ give, reject });
        }
      });
    },

    popFront: (): Promise<null | T> => {
      return new Promise<null | T>((take) => {
        if (closed) {
          return take(null);
        }
        if (producers.length > 0) {
          const { give } = producers.shift()!;
          give(take);
        } else {
          consumers.push(take);
        }
      });
    },

    close: (): void => {
      if (closed) return;
      closed = true;
      while (producers.length > 0) {
        producers.shift()!.reject(new Error("queue closed."));
      }
      while (consumers.length > 0) {
        consumers.shift()!(null);
      }
    },
  };
}
