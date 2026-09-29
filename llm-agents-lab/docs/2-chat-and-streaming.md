# 2. Chat: memory is an array, and replies stream

Lesson page: `/chat` · Code: `app/chat/chat-demo.js`, `app/api/chat/route.js`, `lib/http/`

## The model remembers nothing

Every API request stands alone. So how does a chatbot remember what you said? **Your code** keeps the conversation
in an array and sends the whole array with every new message:

```js
// app/chat/chat-demo.js
const history = [...messages, { role: "user", content: text }];
await postForEvents("/api/chat", { messages: history }, onEvent);
// …and when the reply is complete:
setMessages([...history, { role: "assistant", content: reply }]);
```

The third message of a chat sends all of this:

```json
[
  { "role": "user", "content": "Hi, my name is Ana" },
  { "role": "assistant", "content": "Nice to meet you, Ana!" },
  { "role": "user", "content": "What is my name?" }
]
```

The model answers "Ana" only because the first message is in the request again.

What follows from that:

- **Cost grows with the conversation.** Each turn sends the history again, so input tokens grow every turn. Lesson 2
  shows the numbers.
- **There is a limit.** A model reads at most its *context window* of tokens at once (1 million for Claude Opus 5.5).
  Very long conversations have to be shortened or summarized.
- **You control the memory.** The model "remembers" exactly what is in the array. A real app would store the array in
  a database, per user.

The chat keeps only the text of each assistant reply, which is allowed and is the simplest way to build a chat. The
tool lessons must keep the complete reply instead; [lesson 3](3-tools.md) explains why.

## Streaming

Without streaming you wait until the whole answer is written. With streaming, text appears piece by piece while the
model is still writing. The path of each piece:

1. **Anthropic → your server.** `client.beta.messages.stream(...)` receives Server-Sent Events: `message_start`, then
   many `content_block_delta` events that each carry a few characters, then `message_delta` (with `stop_reason` and
   `usage`) and `message_stop`.
2. **Your server → the browser.** `app/api/chat/route.js` loops over those events and forwards every piece of text:

   ```js
   for await (const event of stream) {
     if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
       send({ type: "text", text: event.delta.text });
     }
   }
   const message = await stream.finalMessage();
   send({ type: "done", stopReason: message.stop_reason, usage: message.usage });
   ```

   `streamEvents()` in `lib/http/server.js` writes each event as one line of JSON (the "NDJSON" format) into a
   streaming `Response`, while the handler is still running.
3. **The browser.** `postForEvents()` in `lib/http/browser.js` reads the response body chunk by chunk, splits it into
   lines, parses each line, and hands the event to the page, which appends the text to the bubble.

```text
Claude ──SSE events──▶ route.js ──one JSON line per event──▶ postForEvents() ──▶ React state ──▶ screen
```

Why not let the browser read Anthropic's stream directly? It would need your API key.

If you close the tab mid-answer, the browser cancels the request. `streamEvents()` notices and aborts the request to
Anthropic too (the `signal` it passes to the SDK), so you don't pay for text nobody reads.

Next: [3. Tools: the model asks, your code acts](3-tools.md)
