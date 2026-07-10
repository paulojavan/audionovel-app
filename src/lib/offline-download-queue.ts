export type OfflineDownloadQueueStatus = {
  state: "queued" | "running";
  position: number;
};

type QueueItem<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  onStatus?: (status: OfflineDownloadQueueStatus) => void;
};

const queue: Array<QueueItem<unknown>> = [];
let running = false;

function notifyQueuedItems() {
  queue.forEach((item, index) => {
    item.onStatus?.({ state: "queued", position: index + 1 });
  });
}

async function drainQueue() {
  if (running) return;

  const item = queue.shift();
  if (!item) return;

  notifyQueuedItems();
  running = true;
  item.onStatus?.({ state: "running", position: 0 });

  try {
    item.resolve(await item.task());
  } catch (error) {
    item.reject(error);
  } finally {
    running = false;
    void drainQueue();
  }
}

export function enqueueOfflineDownload<T>(
  task: () => Promise<T>,
  onStatus?: (status: OfflineDownloadQueueStatus) => void,
) {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      task,
      resolve: resolve as (value: unknown) => void,
      reject,
      onStatus,
    });
    notifyQueuedItems();
    void drainQueue();
  });
}
