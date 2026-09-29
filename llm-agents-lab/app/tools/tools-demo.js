"use client";

import { useState } from "react";
import ContentBlocks from "@/components/content-blocks";
import JsonView from "@/components/json-view";
import { postJson } from "@/lib/http/browser";

const EXAMPLE_QUESTION = "What time is it in Tokyo right now? And what is 1234 × 5678?";

export default function ToolsDemo({ toolDefinitions }) {
  const [question, setQuestion] = useState(EXAMPLE_QUESTION);
  // The full conversation in API format, tool_use and tool_result blocks included.
  const [messages, setMessages] = useState([]);
  const [stopReason, setStopReason] = useState(null);
  const [results, setResults] = useState({}); // tool_use id -> { content, isError }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The tool calls in Claude's latest reply that are waiting for results.
  const lastMessage = messages.at(-1);
  const pendingCalls =
    stopReason === "tool_use" && lastMessage?.role === "assistant"
      ? lastMessage.content.filter((block) => block.type === "tool_use")
      : [];
  const allToolsRan = pendingCalls.length > 0 && pendingCalls.every((call) => results[call.id]);
  const modelCalls = messages.filter((message) => message.role === "assistant").length;

  // Step A: send the conversation to Claude and append its reply, unchanged.
  async function askClaude(conversation) {
    setBusy(true);
    setError("");
    try {
      const reply = await postJson("/api/tools/step", { messages: conversation });
      setMessages([...conversation, { role: "assistant", content: reply.content }]);
      setStopReason(reply.stop_reason);
      setResults({});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function start(event) {
    event.preventDefault();
    const conversation = [{ role: "user", content: question }];
    setMessages(conversation);
    setStopReason(null);
    askClaude(conversation);
  }

  // Step B: run one tool Claude asked for. It runs on the server, not here.
  async function runCall(call) {
    setBusy(true);
    setError("");
    try {
      const result = await postJson("/api/tools/run", { name: call.name, input: call.input });
      setResults((previous) => ({ ...previous, [call.id]: result }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Step C: send ALL results back in ONE user message, and ask Claude again.
  function sendResults() {
    const toolResults = pendingCalls.map((call) => ({
      type: "tool_result",
      tool_use_id: call.id,
      content: results[call.id].content,
      is_error: results[call.id].isError,
    }));
    askClaude([...messages, { role: "user", content: toolResults }]);
  }

  function startOver() {
    setMessages([]);
    setStopReason(null);
    setResults({});
    setError("");
  }

  return (
    <div className="stack">
      <form onSubmit={start} className="card stack">
        <label>
          Your question
          <textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} required />
        </label>
        <div className="row">
          <button disabled={busy}>Ask Claude</button>
          {messages.length > 0 && (
            <button type="button" className="secondary" onClick={startOver} disabled={busy}>
              Start over
            </button>
          )}
        </div>
      </form>

      {messages.map((message, index) => (
        <section key={index} className={`card stack turn ${message.role}`}>
          <p className="tag">
            messages[{index}] · role: &quot;{message.role}&quot;
          </p>
          <ContentBlocks content={message.content} />
        </section>
      ))}

      {busy && <p className="muted">Working…</p>}
      {error && <p className="error">{error}</p>}

      {pendingCalls.length > 0 && (
        <section className="card stack">
          <h2>Your turn: you are the agent loop</h2>
          <p>
            Claude stopped with <code>stop_reason: &quot;tool_use&quot;</code> and is waiting for{" "}
            {pendingCalls.length === 1 ? "this result" : `these ${pendingCalls.length} results`}.
          </p>
          {pendingCalls.map((call) => (
            <div key={call.id} className="stack">
              <div className="row">
                <code>
                  {call.name}({JSON.stringify(call.input)})
                </code>
                <button className="secondary" onClick={() => runCall(call)} disabled={busy || Boolean(results[call.id])}>
                  {results[call.id] ? "Done" : "Run tool"}
                </button>
              </div>
              {results[call.id] && (
                <ContentBlocks
                  content={[
                    {
                      type: "tool_result",
                      tool_use_id: call.id,
                      content: results[call.id].content,
                      is_error: results[call.id].isError,
                    },
                  ]}
                />
              )}
            </div>
          ))}
          <button onClick={sendResults} disabled={busy || !allToolsRan}>
            Send {pendingCalls.length === 1 ? "the result" : "all results"} back to Claude
          </button>
        </section>
      )}

      {stopReason === "end_turn" && (
        <p className="status ok">
          Done: <code>stop_reason: &quot;end_turn&quot;</code>. The last message above is the final answer. Claude was
          called {modelCalls} {modelCalls === 1 ? "time" : "times"}; lesson 4 automates exactly these clicks.
        </p>
      )}
      {stopReason === "refusal" && <p className="notice">Claude declined this request (stop_reason: refusal).</p>}
      {stopReason === "max_tokens" && <p className="notice">The reply was cut off (stop_reason: max_tokens).</p>}

      <JsonView label="Tool definitions: everything Claude knows about the tools" value={toolDefinitions} />
      {messages.length > 0 && <JsonView label="The conversation array that the next request sends" value={messages} />}
    </div>
  );
}
