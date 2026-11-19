const UTF8_BOM = "\uFEFF";

export function csvAttachmentFilename(filename) {
  return String(filename || "download.csv").replace(/[^\w.\-]+/g, "_");
}

export function setCsvDownloadHeaders(res, filename) {
  const safe = csvAttachmentFilename(filename);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
}

export function sendCsvDownload(res, filename, body) {
  setCsvDownloadHeaders(res, filename);
  const text = body.startsWith(UTF8_BOM) ? body : `${UTF8_BOM}${body}`;
  res.status(200).send(text);
}