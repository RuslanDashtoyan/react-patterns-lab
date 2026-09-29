// The Anthropic SDK client, plus turning its errors into readable messages.
//
// This line makes the build FAIL if a Client Component ("use client") ever
// imports this file, so the API key can never be bundled for the browser.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client;

// Returns the one SDK client for this server process. `new Anthropic()` reads
// ANTHROPIC_API_KEY from process.env (Next.js loads it from .env.local).
export function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingApiKeyError();
  }
  client ??= new Anthropic();
  return client;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local, paste your key, then restart `npm run dev`.",
    );
    this.name = "MissingApiKeyError";
  }
}

// Maps an error to { status, message } for our Route Handlers.
// Most specific classes first: they all extend Anthropic.APIError.
export function describeError(error) {
  if (error instanceof MissingApiKeyError) {
    return { status: 500, message: error.message };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 401, message: "Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY in .env.local." };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return { status: 403, message: `Your API key has no access to this (403): ${apiMessage(error)}` };
  }
  if (error instanceof Anthropic.NotFoundError) {
    return { status: 404, message: `Not found (404), often a wrong model name in lib/llm/config.js: ${apiMessage(error)}` };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Rate limited (429). Wait a few seconds and try again." };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { status: 400, message: `Anthropic rejected the request (400): ${apiMessage(error)}` };
  }
  if (error instanceof Anthropic.APIUserAbortError) {
    return { status: 499, message: "Stopped." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 502, message: "Could not reach api.anthropic.com. Check your internet connection." };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: error.status ?? 500, message: `Anthropic API error ${error.status ?? ""}: ${apiMessage(error)}` };
  }
  return { status: 500, message: error instanceof Error ? error.message : String(error) };
}

// The API's own explanation (e.g. "max_tokens: Field required") from the error
// body { type: "error", error: { type, message } }, without the raw JSON around it.
function apiMessage(error) {
  return error.error?.error?.message ?? error.message;
}
