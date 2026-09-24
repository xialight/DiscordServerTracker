import { config } from '../config.js';

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const STRIP_HTML_REGEX = /<[^>]+>/g;
const REQUEST_TIMEOUT_MS = 10_000;

export async function braveWebSearch(query, count = 5) {
  const url = new URL(BRAVE_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': config.braveApiKey,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Brave Search request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const results = data.web?.results ?? [];

  return results.map((result) => ({
    title: result.title ?? '',
    url: result.url,
    description: (result.description ?? '').replace(STRIP_HTML_REGEX, ''),
  }));
}
