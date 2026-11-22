/** An API error with an HTTP status and a stable error code that is safe to show to the client. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

/** A JSON response with the given status that is never cached. */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Runs an API action and turns its result or error into a JSON response; unknown errors become a generic 500 with no internal details. */
export async function respond(action: () => Promise<unknown>): Promise<Response> {
  try {
    return json(await action());
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: { code: error.code, message: error.message } }, error.status);
    }
    // Database details, tokens, and exception messages never enter the response.
    return json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, 500);
  }
}
