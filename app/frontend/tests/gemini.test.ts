import assert from "node:assert/strict";
import { test } from "node:test";
import { createGeminiCaller, GeminiError } from "../lib/spatial/server/gemini";

type Call = { url: string; init: RequestInit };

/** Fake fetch that records the request and answers with the given body and status. */
function fakeFetch(body: unknown, status = 200, calls: Call[] = []): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}
const answer = (parts: { text: string; thought?: boolean }[]) => ({
  modelVersion: "gemini-test-001", candidates: [{ content: { parts } }],
});

test("sends the prompt with the key in a header and asks for JSON", async () => {
  const calls: Call[] = [];
  const gemini = createGeminiCaller({ apiKey: "test-key", fetchImpl: fakeFetch(answer([{ text: "{}" }]), 200, calls) });
  const result = await gemini("hello");
  assert.deepEqual(result, { text: "{}", model_version: "gemini-test-001" });
  assert.match(calls[0].url, /models\/gemini-flash-lite-latest:generateContent$/);
  assert.doesNotMatch(calls[0].url, /test-key/);
  assert.equal((calls[0].init.headers as Record<string, string>)["x-goog-api-key"], "test-key");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.contents[0].parts[0].text, "hello");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
});

test("skips thought parts and joins the answer parts", async () => {
  const gemini = createGeminiCaller({
    apiKey: "k", fetchImpl: fakeFetch(answer([{ text: "thinking...", thought: true }, { text: '{"a":' }, { text: "1}" }])),
  });
  assert.equal((await gemini("x")).text, '{"a":1}');
});

test("HTTP errors become a failed GeminiError without Google's body", async () => {
  const gemini = createGeminiCaller({ apiKey: "k", fetchImpl: fakeFetch({ error: { message: "secret prompt echo" } }, 403) });
  await assert.rejects(gemini("x"), (error: GeminiError) =>
    error.kind === "failed" && error.message === "Gemini returned HTTP 403");
});

test("an empty answer is a failure", async () => {
  const gemini = createGeminiCaller({ apiKey: "k", fetchImpl: fakeFetch({ candidates: [] }) });
  await assert.rejects(gemini("x"), { kind: "failed" });
});

test("a slow Gemini times out", async () => {
  // Node does not keep the process alive for AbortSignal.timeout, so hold it open until the abort.
  const slow = ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => {}, 1000);
    init.signal?.addEventListener("abort", () => { clearTimeout(keepAlive); reject(init.signal?.reason); });
  })) as unknown as typeof fetch;
  const gemini = createGeminiCaller({ apiKey: "k", timeoutMs: 20, fetchImpl: slow });
  await assert.rejects(gemini("x"), { kind: "timed_out" });
});

test("network errors become a failed GeminiError", async () => {
  const broken = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  await assert.rejects(createGeminiCaller({ apiKey: "k", fetchImpl: broken })("x"), { kind: "failed" });
});

/** Fake fetch that answers with each status in turn, then 200 with a JSON answer. */
function flaky(statuses: number[], calls: { count: number }): typeof fetch {
  return (async () => {
    const status = statuses[calls.count++];
    return status
      ? new Response("{}", { status })
      : new Response(JSON.stringify(answer([{ text: "{}" }])), { status: 200 });
  }) as unknown as typeof fetch;
}

test("retries when Google is busy and succeeds on a later try", async () => {
  const calls = { count: 0 };
  const gemini = createGeminiCaller({ apiKey: "k", retryDelayMs: 0, fetchImpl: flaky([503, 429], calls) });
  assert.equal((await gemini("x")).text, "{}");
  assert.equal(calls.count, 3);
});

test("gives up after 3 busy answers", async () => {
  const calls = { count: 0 };
  const gemini = createGeminiCaller({ apiKey: "k", retryDelayMs: 0, fetchImpl: flaky([503, 503, 503], calls) });
  await assert.rejects(gemini("x"), { message: "Gemini returned HTTP 503" });
  assert.equal(calls.count, 3);
});

test("does not retry errors that will not fix themselves, like 400", async () => {
  const calls = { count: 0 };
  const gemini = createGeminiCaller({ apiKey: "k", retryDelayMs: 0, fetchImpl: flaky([400], calls) });
  await assert.rejects(gemini("x"), { message: "Gemini returned HTTP 400" });
  assert.equal(calls.count, 1);
});
