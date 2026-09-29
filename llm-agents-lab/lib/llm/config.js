// Settings every request to Claude shares.
// No secrets here, so any file may import this one. The API key is only
// touched in lib/llm/client.js, which is server-only.

// Which Claude model answers. Model list: https://platform.claude.com/docs/en/models/overview
export const MODEL = "claude-opus-5-5";

export const COMMON_PARAMS = {
  model: MODEL,
  // If Claude's safety classifiers decline a request, the API re-runs it on the
  // fallback model Anthropic recommends for that case, instead of only refusing.
  // `betas` is sent as the `anthropic-beta` HTTP header, not in the JSON body.
  // These two lines go together: if you switch to an older model and get a 400
  // about `fallbacks`, delete both.
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};
