// Lesson 4: run the agent loop on the server and stream every step to the page.
import { getAnthropic } from "@/lib/llm/client";
import { streamEvents } from "@/lib/http/server";
import { runAgent } from "@/lib/agent/run-agent";

export async function POST(request) {
  const { task } = await request.json().catch(() => ({}));
  if (typeof task !== "string" || !task.trim()) {
    return Response.json({ error: "Describe a task first." }, { status: 400 });
  }

  // Each event runAgent reports (step started, tool called, final answer...)
  // goes straight to the browser as one line of the stream.
  return streamEvents(request, (send, signal) =>
    runAgent({ client: getAnthropic(), task, onEvent: send, signal }),
  );
}
