import { fetchWithRetry } from './httpRetry.js';

const DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export async function lookupDefinition(word) {
  const response = await fetchWithRetry(`${DICTIONARY_URL}/${encodeURIComponent(word)}`);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Dictionary request failed: ${response.status} ${response.statusText}`);
  }

  const entries = await response.json();
  return entries[0] ?? null;
}
