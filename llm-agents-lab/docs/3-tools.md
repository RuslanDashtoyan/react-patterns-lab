# 3. Tools: the model asks, your code acts

Lesson page: `/tools` · Code: `lib/tools/`, `app/api/tools/step/route.js`, `app/api/tools/run/route.js`,
`app/tools/tools-demo.js`

## Why tools

An LLM only produces text. It can't know the current time, can't fetch today's weather, and can get long arithmetic
wrong, because it predicts digits instead of calculating them. Tools fix that: you **describe** functions to the
model, the model **asks** you to run one when it would help, and **your code** runs it and sends back the result.

The model never executes anything. It only writes a request, and you decide what actually runs.

## A tool = a definition + a function

```js
// lib/tools/calculator.js, shortened
export const calculator = {
  definition: {                         // what the MODEL sees
    name: "calculator",
    description: "Exact arithmetic on two numbers. Use it for every calculation instead of doing math in your head. …",
    input_schema: {                     // JSON Schema for the input
      type: "object",
      properties: {
        operation: { type: "string", enum: ["add", "subtract", "multiply", "divide", "power"] },
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["operation", "a", "b"],
      additionalProperties: false,
    },
    strict: true,                       // the API guarantees the input matches the schema
  },
  run({ operation, a, b }) { /* … */ }, // what YOUR CODE does
};
```

- The **description** is a prompt: it is how the model decides *when* to use the tool. With a vague description the
  tool gets used at the wrong moments, or never.
- The **input_schema** says which arguments to send. With `strict: true`, the input is guaranteed to match it.
- **`run()`** is ordinary JavaScript. Here it does math, but it could query your database, call an API or send an
  email.

`lib/tools/index.js` collects the tools into `TOOL_DEFINITIONS` (sent with every request) and `runTool(name, input)`
(finds the tool, runs it, and turns any error into an error result).

## The protocol, step by step

The lesson 3 question: *"What time is it in Tokyo right now? And what is 1234 × 5678?"*

**Request 1:** your question, plus `tools: TOOL_DEFINITIONS`.

**Response 1:** no answer yet. Two tool requests, and `stop_reason: "tool_use"`:

```json
"content": [
  { "type": "thinking", "thinking": "Two independent lookups…", "signature": "…" },
  { "type": "tool_use", "id": "toolu_01", "name": "get_current_time", "input": { "timezone": "Asia/Tokyo" } },
  { "type": "tool_use", "id": "toolu_02", "name": "calculator", "input": { "operation": "multiply", "a": 1234, "b": 5678 } }
],
"stop_reason": "tool_use"
```

**Your code** runs both tools.

**Request 2:** the whole conversation again, now with two more messages:

```json
[
  { "role": "user", "content": "What time is it in Tokyo right now? And what is 1234 × 5678?" },
  { "role": "assistant", "content": ["…every block of response 1, unchanged…"] },
  { "role": "user", "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "{\"timezone\":\"Asia/Tokyo\",\"local_time\":\"…\"}" },
    { "type": "tool_result", "tool_use_id": "toolu_02", "content": "{\"result\":7006652}" }
  ]}
]
```

**Response 2:** `stop_reason: "end_turn"`, and the answer as text.

The rules:

1. **Send the assistant reply back unchanged, every block included.** Thinking blocks carry a `signature` that the
   API checks, and a `tool_use` must be present for its `tool_result` to make sense.
2. **Every `tool_use` gets a `tool_result`** with the same id in `tool_use_id`.
3. **Several `tool_use` blocks in one reply are parallel calls.** Run them (at the same time, if you like) and return
   **all** results in **one** user message.
4. **A failed tool still gets a result:** `is_error: true` and the error text. The model reads it and can retry with
   different input, or explain what went wrong.

## Where tools run

On your server: in lesson 3 through `app/api/tools/run/route.js`, in lesson 4 inside `runAgent()`. Never in the
browser, because real tools often need secrets such as database passwords or API keys.

The model chooses the *inputs*, so treat them like user input. Give the model only tools you're happy for it to call
with any arguments, and check anything with side effects (payments, deleting data, sending messages) before doing it.

On Claude Opus 5.5 you can't force the model to call one specific tool (`tool_choice` with `type: "tool"` is rejected).
The model decides; say in the system prompt when tools should be used, as `TOOL_USE_PARAMS` in
`lib/agent/run-agent.js` does.

## Add your own tool

1. Create `lib/tools/your-tool.js` with a `definition` and a `run` (copy `calculator.js`).
2. Import it in `lib/tools/index.js` and add it to `TOOLS`.
3. Reload lesson 3 or 4: the new definition is sent automatically.
4. Add a test to `lib/tools/tools.test.js` and run `npm test`.

Next: [4. Agents: the tool loop, automated](4-agents.md)
