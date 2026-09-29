// The agent loop is plain JavaScript, so it can be tested without calling
// Claude: a fake client plays back scripted responses. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent, TOOL_USE_PARAMS } from "./run-agent.js";

// Plays back `responses` in order and records a snapshot of every request.
function fakeClient(responses) {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        async create(params) {
          requests.push(structuredClone(params)); // snapshot: the loop keeps appending to `messages`
          if (responses.length === 0) throw new Error("fake client ran out of scripted responses");
          return responses.shift();
        },
      },
    },
  };
}

const usage = { input_tokens: 10, output_tokens: 5 };

const toolUse = (id, input) => ({ type: "tool_use", id, name: "calculator", input });

test("runs the tool the model asks for, then returns the final answer", async () => {
  const firstReply = [
    { type: "thinking", thinking: "I should use the calculator.", signature: "sig-1" },
    toolUse("call_1", { operation: "multiply", a: 6, b: 7 }),
  ];
  const client = fakeClient([
    { stop_reason: "tool_use", content: firstReply, usage },
    { stop_reason: "end_turn", content: [{ type: "text", text: "6 × 7 = 42" }], usage },
  ]);
  const events = [];

  const result = await runAgent({ client, task: "What is 6 × 7?", onEvent: (event) => events.push(event) });

  assert.equal(result.status, "done");
  assert.equal(result.text, "6 × 7 = 42");
  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "llm_request", "llm_response", "tool_call", "tool_result", "llm_request", "llm_response", "final"],
  );

  const [first, second] = client.requests;
  assert.deepEqual(first.messages, [{ role: "user", content: "What is 6 × 7?" }]);
  assert.deepEqual(second.messages, [
    { role: "user", content: "What is 6 × 7?" },
    { role: "assistant", content: firstReply }, // exactly as received, thinking block included
    {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "call_1", content: '{"result":42}', is_error: false }],
    },
  ]);
});

test("every request repeats the previous one and only appends (history is never edited)", async () => {
  const client = fakeClient([
    { stop_reason: "tool_use", content: [toolUse("a", { operation: "add", a: 1, b: 2 })], usage },
    { stop_reason: "tool_use", content: [toolUse("b", { operation: "add", a: 3, b: 3 })], usage },
    { stop_reason: "end_turn", content: [{ type: "text", text: "6" }], usage },
  ]);

  await runAgent({ client, task: "Add things" });

  for (let i = 1; i < client.requests.length; i++) {
    const previous = client.requests[i - 1].messages;
    const current = client.requests[i].messages;
    assert.deepEqual(current.slice(0, previous.length), previous);
    assert.equal(current.length, previous.length + 2); // + assistant turn + tool results
  }
});

test("parallel tool calls: all results go back together in one user message", async () => {
  const client = fakeClient([
    {
      stop_reason: "tool_use",
      content: [toolUse("x", { operation: "add", a: 1, b: 2 }), toolUse("y", { operation: "multiply", a: 3, b: 4 })],
      usage,
    },
    { stop_reason: "end_turn", content: [{ type: "text", text: "3 and 12" }], usage },
  ]);

  await runAgent({ client, task: "1+2 and 3×4" });

  const lastMessage = client.requests[1].messages.at(-1);
  assert.equal(lastMessage.role, "user");
  assert.deepEqual(
    lastMessage.content.map((block) => [block.tool_use_id, block.content]),
    [
      ["x", '{"result":3}'],
      ["y", '{"result":12}'],
    ],
  );
});

test("a failing tool becomes an is_error result the model can react to", async () => {
  const client = fakeClient([
    { stop_reason: "tool_use", content: [toolUse("z", { operation: "divide", a: 1, b: 0 })], usage },
    { stop_reason: "end_turn", content: [{ type: "text", text: "You can't divide by zero." }], usage },
  ]);

  const result = await runAgent({ client, task: "1 / 0" });

  assert.equal(result.status, "done");
  const [toolResult] = client.requests[1].messages.at(-1).content;
  assert.equal(toolResult.is_error, true);
  assert.equal(toolResult.content, "Cannot divide by zero.");
});

test("stops at maxSteps if the model never finishes", async () => {
  const endless = Array.from({ length: 5 }, (_, i) => ({
    stop_reason: "tool_use",
    content: [toolUse(`loop_${i}`, { operation: "add", a: i, b: 1 })],
    usage,
  }));
  const client = fakeClient(endless);
  const events = [];

  const result = await runAgent({ client, task: "Never stop", maxSteps: 3, onEvent: (event) => events.push(event) });

  assert.equal(result.status, "max_steps");
  assert.equal(client.requests.length, 3);
  assert.equal(events.at(-1).type, "error");
});

test("stops without running tools when the request is declined", async () => {
  const client = fakeClient([
    { stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber" }, content: [], usage },
  ]);
  const events = [];

  const result = await runAgent({ client, task: "Something declined", onEvent: (event) => events.push(event) });

  assert.equal(result.status, "refused");
  assert.deepEqual(events.at(-1), { type: "refusal", category: "cyber" });
  assert.equal(events.some((event) => event.type === "tool_call"), false);
});

test("every request carries the model, the tools and the shared settings", async () => {
  const client = fakeClient([{ stop_reason: "end_turn", content: [{ type: "text", text: "Hi" }], usage }]);

  await runAgent({ client, task: "Hi" });

  const [request] = client.requests;
  assert.equal(request.model, TOOL_USE_PARAMS.model);
  assert.deepEqual(request.tools, TOOL_USE_PARAMS.tools);
  assert.equal(request.fallbacks, "default");
  assert.deepEqual(
    request.tools.map((tool) => tool.name),
    ["get_current_time", "get_weather", "calculator"],
  );
});
