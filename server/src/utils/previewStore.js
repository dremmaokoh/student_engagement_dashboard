const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_PREVIEWS_PER_OWNER = 10;
const SWEEP_INTERVAL_MS = 60 * 1000;

export function createPreviewStore() {
  const entries = new Map();

  function isStale(entry, now = Date.now()) {
    return now - entry.createdAt >= PREVIEW_TTL_MS;
  }

  function sweep(now = Date.now()) {
    for (const [key, entry] of entries) {
      if (isStale(entry, now)) {
        entries.delete(key);
      }
    }
  }

  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return {
    get(key, ownerKey) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (isStale(entry)) {
        entries.delete(key);
        return null;
      }
      if (ownerKey && entry.ownerKey !== ownerKey) return null;
      return entry.preview;
    },
    set(key, ownerKey, preview) {
      sweep();
      const sameOwner = [];
      for (const [entryKey, entry] of entries) {
        if (entry.ownerKey === ownerKey) {
          sameOwner.push({ entryKey, createdAt: entry.createdAt });
        }
      }
      if (sameOwner.length >= MAX_PREVIEWS_PER_OWNER) {
        sameOwner.sort((a, b) => a.createdAt - b.createdAt);
        const removeCount = sameOwner.length - MAX_PREVIEWS_PER_OWNER + 1;
        for (const item of sameOwner.slice(0, removeCount)) {
          entries.delete(item.entryKey);
        }
      }
      entries.set(key, { ownerKey, createdAt: Date.now(), preview });
    },
    delete(key) {
      entries.delete(key);
    },
  };
}
