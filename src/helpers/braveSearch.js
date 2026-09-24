import { config } from '../config.js';
import { fetchWithRetry } from './httpRetry.js';

const WEB_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const SUMMARIZER_URL = 'https://api.search.brave.com/res/v1/summarizer/search';

function authHeaders() {
  return {
    Accept: 'application/json',
    'X-Subscription-Token': config.braveApiKey,
  };
}

// Step 1: a normal web search request with summary=1. If the query is
// eligible for an AI overview, the response carries an opaque summarizer key
// (not the summary itself) that step 2 exchanges for the actual answer.
async function requestSummaryKey(query) {
  const url = new URL(WEB_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('summary', '1');

  const response = await fetchWithRetry(url, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Brave web search request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.summarizer?.key ?? null;
}

// Step 2: exchange the key for the generated summary.
async function requestSummary(key) {
  const url = new URL(SUMMARIZER_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('entity_info', '1');

  const response = await fetchWithRetry(url, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Brave summarizer request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Brave's docs for the exact response shape are behind a login-gated
// dashboard we couldn't verify directly, so this tries the shapes described
// in their public doc excerpts and returns null (caller logs the raw
// response) rather than guessing wrong and silently showing nothing.
function extractSummaryText(summary) {
  if (Array.isArray(summary?.summary)) {
    const text = summary.summary
      .filter((block) => typeof block?.data === 'string')
      .map((block) => block.data)
      .join(' ')
      .trim();
    if (text) return text;
  }
  if (typeof summary?.summary === 'string' && summary.summary.trim()) {
    return summary.summary.trim();
  }
  if (typeof summary?.answer?.text === 'string' && summary.answer.text.trim()) {
    return summary.answer.text.trim();
  }
  return null;
}

export async function braveAnswerSummary(query) {
  const key = await requestSummaryKey(query);
  if (!key) return { available: false };

  const summary = await requestSummary(key);
  const text = extractSummaryText(summary);

  if (!text) {
    console.error('Brave summarizer: could not extract summary text from response:', JSON.stringify(summary));
    return { available: false };
  }

  return { available: true, text };
}
