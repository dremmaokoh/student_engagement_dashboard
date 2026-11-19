const TOKEN_KEY = "sed_access_token";

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest(path, { method = "GET", body, token, formData } = {}) {
  const headers = {
    Accept: "application/json",
  };

  const requestBody = formData || body;
  const isFormData = typeof FormData !== "undefined" && requestBody instanceof FormData;

  if (requestBody !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const authToken = token ?? getStoredToken();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: isFormData ? requestBody : requestBody !== undefined ? JSON.stringify(requestBody) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function filenameFromContentDisposition(header) {
  if (!header) {
    return null;
  }
  const utf8Match = /filename\*=UTF-8''([^;\s]+)/i.exec(header);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const quotedMatch = /filename="([^"]+)"/i.exec(header);
  if (quotedMatch) {
    return quotedMatch[1];
  }
  const plainMatch = /filename=([^;\s]+)/i.exec(header);
  if (plainMatch) {
    return plainMatch[1].replace(/^"|"$/g, "");
  }
  return null;
}

export function saveBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function downloadAuthenticated(path, filename) {
  const headers = { Accept: "text/csv" };
  const authToken = getStoredToken();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(path, { headers, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || `Download failed (${response.status})`);
  }

  const resolvedFilename =
    filenameFromContentDisposition(response.headers.get("Content-Disposition")) || filename || "download.csv";
  const contentType = response.headers.get("Content-Type") || "text/csv;charset=utf-8";
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: contentType });
  saveBlobAsFile(blob, resolvedFilename);
}