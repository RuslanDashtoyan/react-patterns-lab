# 4. Agents: the tool loop, automated

Lesson page: `/agent` · Code: `lib/agent/run-agent.js`, `app/api/agent/route.js`, `app/agent/agent-demo.js`

## What an agent is

In lesson 3 you did this by hand:

1. ask Claude,
2. if it asks for tools, run them,
3. send back the results,
4. repeat until it answers.

An **agent** is that loop, written as code. The model decides what happens next: which tool, with which arguments,
and when it is finished. Your code carries it out.

Lessons 3 and 4 send exactly the same requests (`TOOL_USE_PARAMS` in `lib/agent/run-agent.js`). The only difference
is who runs the loop: you, by clicking, or `runAgent()`.

## The loop

The core of `lib/agent/run-agent.js`:

```js
const messages = [{ role: "user", content: task }];

for (let step = 1; step <= maxSteps; step++) {
  // 1. Ask the model, sending the whole conversation so far.
  const response = await client.beta.messages.create({ ...TOOL_USE_PARAMS, messages });

  // 2. Remember its reply exactly as received.
  messages.push({ role: "assistant", content: response.content });

  // 3. It didn't ask for a tool? Then it's done.
  if (response.stop_reason !== "tool_use") return /* the text of the reply */;

  // 4. Run every tool it asked for, in parallel.
  const toolCalls = response.content.filter((block) => block.type === "tool_use");
  const toolResults = await Promise.all(
    toolCalls.map(async (call) => {
      const { content, isError } = await runTool(call.name, call.input);
      return { type: "tool_result", tool_use_id: call.id, content, is_error: isError };
    }),
  );

  // 5. Send all results back in one message, then loop.
  messages.push({ role: "user", content: toolResults });
}
```

The real file adds `onEvent(...)` calls, so the page can draw each step, and handles `stop_reason: "refusal"`.

## A typical run: "Calculate (17 × 23 + 4) to the power of 2"

| Step | Claude                                                             | Your code                          |
|------|--------------------------------------------------------------------|------------------------------------|
| 1    | thinks "first 17 × 23", asks for `calculator(multiply, 17, 23)`    | runs it: `{"result":391}`          |
| 2    | "now add 4": `calculator(add, 391, 4)`                             | `{"result":395}`                   |
| 3    | "now square it": `calculator(power, 395, 2)`                       | `{"result":156025}`                |
| 4    | "(17 × 23 + 4)² = 156025", `stop_reason: "end_turn"`               | the loop ends                      |

Nobody wrote "multiply, then add, then square" in the code: the model planned it. Each step needed the previous
result, so the task took four model calls. For independent questions, like the weather in London *and* in Paris, the
model asks for both tools in the same step, and they run in parallel.

The real model decides its own steps, so your runs can differ from this table.

## Rules that keep an agent working

- **Clear stopping points.** The loop stops when `stop_reason` isn't `tool_use`, and also after `maxSteps` model
  calls, so a confused model can't loop forever (and keep costing money).
- **Append only.** Never edit or delete earlier messages. A thinking block's signature is tied to the conversation
  before it, so after an edit the API rejects the request. Appending only also keeps the prompt cache working, which
  makes repeated history cheaper. `lib/agent/run-agent.test.js` checks this.
- **Errors are information.** A failing tool returns `is_error: true` with a message, and the model can try again or
  explain. Try the "A tool fails" example in lesson 4.
- **You can stop it.** The Stop button aborts the browser's request. `streamEvents()` on the server notices and aborts
  the request to Anthropic (the `signal`).
- **Least privilege.** The agent can only do what its tools allow. Give it read-only tools unless it really needs
  more, and ask a human before anything destructive.

## Showing progress

An agent run takes a while. `runAgent()` reports every step through `onEvent(...)`: `start`, `llm_request`,
`llm_response`, `tool_call`, `tool_result`, `final`. The route `app/api/agent/route.js` forwards each event to the
browser as one line of JSON (the same streaming as in lesson 2), and the page adds it to the timeline as it arrives.

## Testing an agent without calling Claude

`runAgent()` receives the SDK client as a parameter. The tests pass in a fake client that plays back scripted replies,
then check what the loop did: that it ran the tools, returned results with the right ids, and stopped at `maxSteps`.
Run them with `npm test`. No API key and no network are needed.

## When do you need an agent?

Use the simplest thing that works:

| Task                                                    | Use                                          |
|---------------------------------------------------------|----------------------------------------------|
| Answer, summarize, classify, extract                    | one API call (lesson 1)                      |
| A conversation                                          | a chat: history plus one call per turn (lesson 2) |
| Several steps that you know in advance                  | your own code, calling the model at each step |
| Open-ended tasks where the model must choose the steps  | an agent (lesson 4)                          |

An agent makes several calls per task, each sending the history again, and is harder to predict. Use one when the
task really needs it.

## Beyond this project

- **The SDK's Tool Runner.** Once the manual loop makes sense: `client.beta.messages.toolRunner(...)` runs the same
  loop for you, and you only write the tools (for example with `betaTool()` from
  `@anthropic-ai/sdk/helpers/beta/json-schema`).
- **Claude Managed Agents.** Anthropic runs the loop and hosts a sandbox in which tools like bash and file editing run.
  [Overview](https://platform.claude.com/docs/en/managed-agents/overview).
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): the agent behind Claude Code, as a library, with built-in
  tools for files, the shell and the web.

Next: [5. Where the code lives in a Next.js app](5-where-code-lives.md)
