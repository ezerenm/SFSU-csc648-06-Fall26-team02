// Gemini client for the R16.1 health summary: one request in, plain text out.
//
// Uses the REST API directly with fetch (no SDK), so tests can pass a fake fetch
// and no extra package is needed.
//
// Safety
//   - The key goes in the x-goog-api-key header, never in the URL (URLs end up in logs).
//   - 15-second timeout (Data Definitions 1.15). The caller keeps working without Gemini.
//   - Errors never include Google's response body, which could echo the prompt.
//
// Author: Sumit, Oct 31 2026

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
export const GEMINI_TIMEOUT_MS = 15_000;

/** What one Gemini call returns. model_version is the exact model Google used, for the record. */
export type GeminiResult = { text: string; model_version: string };
export type GeminiCaller = (prompt: string) => Promise<GeminiResult>;

/** "timed_out" when Gemini took longer than the limit, "failed" for everything else. */
export class GeminiError extends Error {
  constructor(public readonly kind: "timed_out" | "failed", message: string) {
    super(message);
  }
}

type GeminiResponse = {
  modelVersion?: string;
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

/**
 * Creates a function that sends one prompt to Gemini and asks for a JSON reply.
 * @param options.apiKey Gemini API key (server only)
 * @param options.model model name, default "gemini-flash-latest"
 * @param options.timeoutMs give up after this many ms, default 15000
 * @param options.fetchImpl fetch to use; tests pass a fake one
 * @returns a caller that resolves with the reply text, or throws GeminiError
 */
export function createGeminiCaller(options: {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): GeminiCaller {
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const timeoutMs = options.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (prompt) => {
    let response: Response;
    try {
      response = await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // Low temperature: we want the same facts explained the same way each time.
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new GeminiError("timed_out", `Gemini did not answer within ${timeoutMs} ms`);
      }
      throw new GeminiError("failed", "Could not reach Gemini");
    }
    if (!response.ok) throw new GeminiError("failed", `Gemini returned HTTP ${response.status}`);

    const data = (await response.json().catch(() => null)) as GeminiResponse | null;
    // Skip "thought" parts: they are the model's private reasoning, not the answer.
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();
    if (!text) throw new GeminiError("failed", "Gemini returned no answer text");
    return { text, model_version: data?.modelVersion ?? model };
  };
}

/**
 * Builds the caller from environment variables, or null when GEMINI_API_KEY is not set.
 * @returns a GeminiCaller, or null so the API can answer "summary unavailable"
 */
export function geminiFromEnv(): GeminiCaller | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return createGeminiCaller({ apiKey, model: process.env.GEMINI_MODEL || undefined });
}
