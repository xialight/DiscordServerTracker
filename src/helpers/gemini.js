import { config } from '../config.js';
import { fetchWithRetry } from './httpRetry.js';

const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// gemini-3.1-flash-lite (switched to for free-tier rate limits) started returning
// 400 Bad Request once billing was enabled and the request reached real validation -
// Gemini's own google_search docs only ever show gemini-3.8-flash as a working
// example, so flash-lite tool support was never actually confirmed. Reverting to
// the model confirmed to work with this tool.
const MODEL = 'gemini-3.8-flash';

function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  // Fallback in case output_text isn't populated for some response shape:
  // walk the steps array for the model_output step's text content directly.
  const modelOutputStep = data.steps?.find((step) => step.type === 'model_output');
  const text = modelOutputStep?.content
    ?.filter((block) => typeof block?.text === 'string')
    .map((block) => block.text)
    .join(' ')
    .trim();

  return text || null;
}

// Grounded search (live Google queries + page retrieval + synthesis) is slower than
// the lightweight calls httpRetry's 15s default was tuned for.
const TIMEOUT_MS = 45_000;

export async function geminiSearchAnswer(query) {
  const startedAt = Date.now();

  let response;
  try {
    // stream explicitly set false (not just omitted) to rule out any chance of the
    // Interactions API defaulting to a streaming response we're not consuming as one.
    response = await fetchWithRetry(
      INTERACTIONS_URL,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': config.geminiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          input: query,
          tools: [{ type: 'google_search' }],
          stream: false,
        }),
      },
      { timeoutMs: TIMEOUT_MS }
    );
  } catch (error) {
    console.error(`Gemini request aborted/failed after ${Date.now() - startedAt}ms`);
    throw error;
  }

  console.log(`Gemini request completed in ${Date.now() - startedAt}ms (status ${response.status})`);

  if (!response.ok) {
    const body = await response.text().catch(() => '<failed to read body>');
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText} - ${body}`);
  }

  const data = await response.json();
  const text = extractText(data);

  if (!text) {
    console.error('Gemini: could not extract text from response:', JSON.stringify(data));
    return { available: false };
  }

  return { available: true, text };
}
