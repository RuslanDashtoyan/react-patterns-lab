# 1. What an LLM is, and what one API call looks like

Lesson page: `/basics` · Code: `app/api/basics/route.js`, `app/basics/basics-demo.js`, `lib/llm/`

## The model

A large language model (LLM) is a program trained on a huge amount of text to do one thing: **given some text,
predict what comes next.** It writes its answer piece by piece, and each piece is a **token**: a short chunk of text,
often a word or part of a word.

That is all an LLM does. It has no database to look things up in, no clock, no internet access and no memory of
earlier conversations. What it "knows" comes from its training data, which stops at a cutoff date, and from the text
you send it right now. Everything else in this project (chat history, tools, agents) is ordinary code built around
that one ability.

## One API call

You talk to Claude through one HTTP endpoint: `POST https://api.anthropic.com/v1/messages`. The SDK
(`@anthropic-ai/sdk`) builds that request for you.

**The request** that `app/api/basics/route.js` sends:

```js
const message = await getAnthropic().beta.messages.create({
  model: "claude-opus-5-5",                 // which model answers
  max_tokens: 16000,                         // upper limit for the reply, thinking included
  system: "You are a patient teacher. …",    // optional rules for the whole conversation
  messages: [                                // the conversation so far
    { role: "user", content: "What is a large language model?" },
  ],
  thinking: { type: "adaptive", display: "summarized" }, // include a summary of its reasoning
  output_config: { effort: "low" },          // how much to think before answering
  // …plus `betas` and `fallbacks` from lib/llm/config.js, explained below
});
```

**The response**, shortened:

```json
{
  "model": "claude-opus-5-5",
  "role": "assistant",
  "content": [
    { "type": "thinking", "thinking": "Short, concrete explanation…", "signature": "…" },
    { "type": "text", "text": "A large language model is…" }
  ],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 42, "output_tokens": 180 }
}
```

| Field         | Meaning                                                                                                          |
|---------------|------------------------------------------------------------------------------------------------------------------|
| `messages`    | The conversation: objects with a `role` (`user` or `assistant`) and `content`. It starts with a `user` message.  |
| `system`      | Instructions that frame the whole conversation: role, tone, rules.                                               |
| `max_tokens`  | Hard limit on how much the model may generate. Thinking counts toward it.                                        |
| `content`     | The reply is a **list of blocks**, not one string. Read each block by its `type`.                                |
| `stop_reason` | Why it stopped: `end_turn` (finished), `max_tokens` (hit your limit), `tool_use` (wants a tool, lesson 3), `refusal` (declined). |
| `usage`       | Tokens in and out. This is what you pay for.                                                                     |

## Thinking and effort

Current Claude models think before they answer. `output_config.effort` sets how much: `low` is fast and cheap,
`high` is slower and more thorough (there are also `xhigh` and `max`). With `display: "summarized"`, the response
includes a readable summary of that thinking as a `thinking` block. Without it, the block comes back with empty text.
You pay for thinking tokens either way.

Try it in lesson 1: ask the same question with effort `low` and then `high`, and compare the time and output tokens.

> Older tutorials set `temperature` to control randomness. Current Claude models such as Opus 5.5 reject that
> parameter. Effort is the setting to use now.

## The two extra lines in `lib/llm/config.js`

```js
betas: ["server-side-fallback-2026-07-01"],
fallbacks: "default",
```

Sometimes Claude's safety classifiers decline a request. With these two lines, the API then re-runs it on a fallback
model that Anthropic recommends, instead of only returning a refusal. `betas` isn't part of the JSON body: the SDK
sends it as the `anthropic-beta` HTTP header. That's also why the code calls `client.beta.messages.create`, the SDK's
entry point for beta features. It works like `client.messages.create`, plus the betas.

## Where the API key goes

The SDK puts your key in the `x-api-key` header of the request to Anthropic. Only your server has it: lesson 1 shows
the request with the key replaced, and the browser never receives the real one. See
[5. Where the code lives](5-where-code-lives.md) for how the project enforces that.

## When the call fails

`describeError()` in `lib/llm/client.js` turns the SDK's typed errors into readable messages: a wrong key is a
`401 AuthenticationError`, too many requests is a `429 RateLimitError`, a wrong model name is a `404 NotFoundError`.
Pages show these messages in red.

Next: [2. Chat: memory is an array, and replies stream](2-chat-and-streaming.md)
