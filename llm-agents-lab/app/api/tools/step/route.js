// Lesson 3, "ask the model": send the conversation plus the tool definitions,
// get ONE reply back. If the reply asks for tools, the page lets you run them.
import { getAnthropic } from "@/lib/llm/client";
import { jsonError } from "@/lib/http/server";
import { TOOL_USE_PARAMS } from "@/lib/agent/run-agent";

export async function POST(request) {
  const { messages } = await request.json().catch(() => ({}));
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Send at least one message." }, { status: 400 });
  }

  try {
    const message = await getAnthropic().beta.messages.create(
      { ...TOOL_USE_PARAMS, messages },
      { signal: request.signal },
    );
    return Response.json(message);
  } catch (error) {
    return jsonError(error);
  }
}
