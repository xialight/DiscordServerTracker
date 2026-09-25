import { config } from '../config.js';
import { fetchWithRetry } from './httpRetry.js';

const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Confirmed working with the google_search tool in Gemini's own grounding docs example.
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

export async function geminiSearchAnswer(query) {
  const response = await fetchWithRetry(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': config.geminiApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: query,
      tools: [{ type: 'google_search' }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = extractText(data);

  if (!text) {
    console.error('Gemini: could not extract text from response:', JSON.stringify(data));
    return { available: false };
  }

  return { available: true, text };
}
