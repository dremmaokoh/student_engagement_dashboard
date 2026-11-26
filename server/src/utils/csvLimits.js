import { HttpError } from "./httpError.js";

export const MAX_CSV_ROWS = 5000;
export const BULK_CHUNK_SIZE = 500;

export function assertCsvRowLimit(records) {
  if (records.length > MAX_CSV_ROWS) {
    throw new HttpError(
      400,
      `This file has ${records.length} rows. The maximum is ${MAX_CSV_ROWS.toLocaleString()} per upload. Please split the file.`,
    );
  }
}

export function chunk(items, size = BULK_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
