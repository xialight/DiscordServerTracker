const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;

// Retries on network failures/timeouts and 5xx responses (both observed in practice
// against these free APIs under load), but not on 4xx — a real 404/401/etc. won't
// change on retry, so failing fast on those keeps commands responsive.
export async function fetchWithRetry(url, options = {}, { retries = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`Request failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
