// Helpers for our Route Handlers (app/api/**/route.js). Server only.
import "server-only";
import { describeError } from "../llm/client.js";

// A JSON error response: { error: "..." } with a fitting HTTP status.
export function jsonError(error) {
  const { status, message } = describeError(error);
  return Response.json({ error: message }, { status });
}

// Streams events to the browser while `run` is still working.
//
// Format: NDJSON (newline-delimited JSON), one JSON object per line:
//   {"type":"text","text":"Hel"}
//   {"type":"text","text":"lo!"}
//   {"type":"done","stopReason":"end_turn"}
//
// `run(send, signal)` calls send(event) as often as it likes. `signal` aborts
// when the browser goes away (tab closed, Stop pressed), so pass it on to the
// SDK to cancel the request to Anthropic as well.
export function streamEvents(request, run) {
  const encoder = new TextEncoder();
  const browserGone = new AbortController();
  const signal = AbortSignal.any([request.signal, browserGone.signal]);
  let open = true;

  const body = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        if (open) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await run(send, signal);
      } catch (error) {
        send({ type: "error", message: describeError(error).message });
      }
      if (open) {
        open = false;
        controller.close();
      }
    },
    cancel() {
      open = false;
      browserGone.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
