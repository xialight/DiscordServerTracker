import { config } from '../config.js';
import { fetchWithRetry } from './httpRetry.js';

const CHAT_COMPLETIONS_URL = 'https://api.search.brave.com/res/v1/chat/completions';

export async function braveAnswerSummary(query) {
  const response = await fetchWithRetry(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
      'X-Subscription-Token': config.braveApiKey,
    },
    body: JSON.stringify({
      stream: false,
      messages: [{ role: 'user', content: query }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Brave Answers request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    console.error('Brave Answers: could not extract text from response:', JSON.stringify(data));
    return { available: false };
  }

  return { available: true, text: text.trim() };
}
