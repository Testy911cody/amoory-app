/* Adaptive audio blob download queue — slow networks: few concurrent;
   fast networks: parallel prefetch. */

export const SLOW_MAX_CONCURRENT = 2;
export const FAST_MAX_CONCURRENT = 10;
export const FAST_CHUNK_SIZE = 12;

export const PRIORITY = {
  tap: 0,
  visible: 1,
  home: 2,
  normal: 3,
  background: 4
};

let syncState = { active: false, total: 0, done: 0, failed: 0 };
const listeners = new Set();

export function getNetworkProfile() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) {
    return { tier: "fast", maxConcurrent: FAST_MAX_CONCURRENT, saveData: false };
  }
  let tier = "fast";
  if (conn.saveData) tier = "slow";
  else if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g" || conn.effectiveType === "3g") {
    tier = "slow";
  } else if (typeof conn.rtt === "number" && conn.rtt > 400) {
    tier = "slow";
  } else if (typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 1) {
    tier = "slow";
  }
  return {
    tier,
    maxConcurrent: tier === "slow" ? SLOW_MAX_CONCURRENT : FAST_MAX_CONCURRENT,
    saveData: !!conn.saveData,
    effectiveType: conn.effectiveType || null
  };
}

export function isSlowNetwork() {
  return getNetworkProfile().tier === "slow";
}

export function onSyncProgress(fn) {
  listeners.add(fn);
  fn({ ...syncState });
  return () => listeners.delete(fn);
}

function notifySync() {
  for (const fn of listeners) fn({ ...syncState });
}

export function resetSyncProgress(total) {
  syncState = { active: total > 0, total, done: 0, failed: 0 };
  notifySync();
}

export function bumpSyncTotal(n) {
  if (n <= 0) return;
  syncState.total += n;
  syncState.active = true;
  notifySync();
}

class DownloadQueue {
  constructor() {
    this.pending = [];
    this.inFlight = new Map();
    this.running = 0;
    this.maxConcurrent = getNetworkProfile().maxConcurrent;
  }

  refreshConcurrency() {
    this.maxConcurrent = getNetworkProfile().maxConcurrent;
  }

  enqueue(task) {
    const inflight = this.inFlight.get(task.id);
    if (inflight) return inflight;

    const idx = this.pending.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      if (task.priority < this.pending[idx].priority) {
        this.pending[idx].priority = task.priority;
        this.pending.sort((a, b) => a.priority - b.priority);
      }
      return this.pending[idx].promise;
    }

    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    this.pending.push({ ...task, resolve, reject, promise });
    this.pending.sort((a, b) => a.priority - b.priority);
    this.pump();
    return promise;
  }

  pump() {
    this.refreshConcurrency();
    while (this.running < this.maxConcurrent && this.pending.length) {
      const task = this.pending.shift();
      this.running++;
      syncState.active = true;
      notifySync();

      const runPromise = (async () => {
        try {
          const result = await task.run();
          syncState.done++;
          task.resolve(result);
          return result;
        } catch (err) {
          syncState.failed++;
          task.reject(err);
          return null;
        } finally {
          this.running--;
          this.inFlight.delete(task.id);
          if (!this.pending.length && !this.running) syncState.active = false;
          notifySync();
          this.pump();
        }
      })();

      this.inFlight.set(task.id, runPromise);
    }
  }
}

const queue = new DownloadQueue();

if (typeof window !== "undefined") {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  conn?.addEventListener?.("change", () => queue.refreshConcurrency());
}

/** Fetch a URL to blob through the adaptive queue. */
export function queueFetchBlob(id, url, { priority = PRIORITY.normal } = {}) {
  if (!url) return Promise.resolve(null);
  bumpSyncTotal(1);
  return queue.enqueue({
    id,
    priority,
    run: async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.blob();
    }
  });
}

/** Run workers over items with connection-aware concurrency. */
export async function runBatched(items, worker, { onItemDone } = {}) {
  if (!items.length) return [];
  const { maxConcurrent } = getNetworkProfile();
  bumpSyncTotal(items.length);
  let idx = 0;
  const results = new Array(items.length);

  async function runSlot() {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await worker(items[i], i);
      } catch {
        results[i] = null;
        syncState.failed++;
      }
      syncState.done++;
      onItemDone?.(items[i], results[i], i);
      notifySync();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrent, items.length) }, () => runSlot())
  );
  syncState.active = false;
  notifySync();
  return results;
}
