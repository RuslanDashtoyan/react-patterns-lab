// Lesson 2: a chat, streamed token by token.
//
// The browser sends the WHOLE conversation every time (the model remembers
// nothing between requests). We stream the reply back piece by piece.
import { getAnthropic } from "@/lib/llm/client";
import { COMMON_PARAMS } from "@/lib/llm/config";
import { streamEvents } from "@/lib/http/server";

const SYSTEM_PROMPT =
  "You are a friendly tutor who explains how LLMs and AI agents work to a JavaScript developer. " +
  "Keep answers short and concrete unless asked for more detail.";

export async function POST(request) {
  const { messages } = await request.json().catch(() => ({}));
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Send at least one message." }, { status: 400 });
  }

  return streamEvents(request, async (send, signal) => {
    const stream = getAnthropic().beta.messages.stream(
      {
        ...COMMON_PARAMS,
        max_tokens: 64000,
        system: SYSTEM_PROMPT,
        output_config: { effort: "low" }, // chat: answer fast rather than think long
        messages,
      },
      { signal },
    );

    // Forward each piece of text the moment it arrives.
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send({ type: "text", text: event.delta.text });
      }
    }

    const message = await stream.finalMessage();
    send({ type: "done", stopReason: message.stop_reason, usage: message.usage, model: message.model });
  });
}
