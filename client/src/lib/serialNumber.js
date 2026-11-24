/** Display-only row numbering. Never derived from database IDs. */
export function serialNumber(index, { page = 1, limit = 0 } = {}) {
  const rowIndex = Math.max(0, Number(index) || 0);
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(0, Number(limit) || 0);
  return pageSize > 0 ? (pageNumber - 1) * pageSize + rowIndex + 1 : rowIndex + 1;
}
