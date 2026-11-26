const DASHBOARD_CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

function cacheKey(lecturerId, query) {
  return `${String(lecturerId)}:${JSON.stringify(query ?? {})}`;
}

export async function withDashboardCache(lecturerId, query, producer) {
  const key = cacheKey(lecturerId, query);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = Promise.resolve().then(producer);
  cache.set(key, { expiresAt: now + DASHBOARD_CACHE_TTL_MS, promise });

  try {
    const value = await promise;
    const current = cache.get(key);
    if (current?.promise === promise) {
      cache.set(key, { expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS, promise: Promise.resolve(value) });
    }
    return value;
  } catch (error) {
    if (cache.get(key)?.promise === promise) {
      cache.delete(key);
    }
    throw error;
  }
}

export function invalidateDashboardCache(lecturerId) {
  const prefix = `${String(lecturerId)}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export function clearDashboardCache() {
  cache.clear();
}
