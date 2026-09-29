// Lesson 1: one prompt in, one answer out.
//
// A Route Handler runs on the SERVER (Node.js), never in the browser. The page
// calls it with fetch("/api/basics"); this code calls Claude with the secret
// API key and returns the result as JSON.
import { getAnthropic } from "@/lib/llm/client";
import { COMMON_PARAMS } from "@/lib/llm/config";
import { jsonError } from "@/lib/http/server";

const EFFORTS = ["low", "medium", "high"];

export async function POST(request) {
  const { system, prompt, effort } = await request.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Write a prompt first." }, { status: 400 });
  }

  const params = {
    ...COMMON_PARAMS,
    max_tokens: 16000, // upper limit on generated tokens, thinking included
    system: system?.trim() || undefined, // optional instructions that frame the conversation
    messages: [{ role: "user", content: prompt }],
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: EFFORTS.includes(effort) ? effort : "low" },
  };

  try {
    const message = await getAnthropic().beta.messages.create(params, { signal: request.signal });
    return Response.json({ request: asHttpRequest(params), response: message });
  } catch (error) {
    return jsonError(error);
  }
}

// Roughly what the SDK sends over the wire, for display: `betas` becomes a
// header and the API key travels in another header. The real key is replaced
// here; it never leaves the server.
function asHttpRequest({ betas, ...body }) {
  return {
    method: "POST",
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "x-api-key": "sk-ant-… (your key from .env.local, hidden)",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": betas.join(","),
      "content-type": "application/json",
    },
    body,
  };
}
