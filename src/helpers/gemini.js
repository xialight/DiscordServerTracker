import { config } from '../config.js';
import { fetchWithRetry } from './httpRetry.js';

const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// gemini-3.1-flash-lite (switched to for free-tier rate limits) started returning
// 400 Bad Request once billing was enabled and the request reached real validation -
// Gemini's own google_search docs only ever show gemini-3.8-flash as a working
// example, so flash-lite tool support was never actually confirmed. Reverting to
// the model confirmed to work with this tool.
const MODEL = 'gemini-3.8-flash';

// Grounded answers can otherwise come back as full long-form articles (e.g. a
// multi-section recipe guide) that blow well past Discord's 4096-char embed
// description limit. Ask for brevity in the system instruction; the actual
// enforced length cap is search.js's character-based truncation, not
// max_output_tokens below.
const SYSTEM_INSTRUCTION =
  'You are answering a question that will be shown in a Discord chat message. Keep your answer concise: a few short paragraphs at most. Summarize rather than giving exhaustive step-by-step detail, even for how-to questions.';

// On Gemini 3.x, max_output_tokens is a COMBINED budget for thinking + visible
// output, not just the visible answer - a tight cap here was silently eating
// almost the whole budget on invisible reasoning and cutting the real answer
// off after a sentence or two. thinking_level: 'low' (lowest gemini-3.8-flash
// supports) reduces how much of the budget reasoning consumes, and
// max_output_tokens is set as a generous ceiling, not the primary length
// control.
const THINKING_LEVEL = 'low';
const MAX_OUTPUT_TOKENS = 2000;

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
          system_instruction: SYSTEM_INSTRUCTION,
          tools: [{ type: 'google_search' }],
          generation_config: { max_output_tokens: MAX_OUTPUT_TOKENS, thinking_level: THINKING_LEVEL },
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
