const DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const REQUEST_TIMEOUT_MS = 10_000;

export async function lookupDefinition(word) {
  const response = await fetch(`${DICTIONARY_URL}/${encodeURIComponent(word)}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Dictionary request failed: ${response.status} ${response.statusText}`);
  }

  const entries = await response.json();
  return entries[0] ?? null;
}
