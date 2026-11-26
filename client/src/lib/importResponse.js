/**
 * `apiRequest` returns the HTTP body (`{ data: batch }`) and `useApiAction`
 * wraps that result as `{ ok, data }`. Import dialogs need the batch itself,
 * not either wrapper, so unwrap exactly one of each layer when present.
 */
export function unwrapImportBatch(result) {
  const payload = result?.data ?? result;
  const batch = payload?.data ?? payload;
  if (!batch || typeof batch !== "object" || Array.isArray(batch) || !("status" in batch)) {
    return null;
  }
  return batch;
}

export function importCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

export function displayImportValue(value) {
  return value === null || value === undefined || value === "" ? "Missing" : String(value);
}
