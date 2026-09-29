"use client";

import { useRef, useState } from "react";
import ContentBlocks from "@/components/content-blocks";
import { postForEvents } from "@/lib/http/browser";

const EXAMPLES = [
  ["Weather + math", "What's the weather in London and in Paris right now, and how many degrees warmer is the warmer city?"],
  ["Time", "What time is it in Tokyo right now, and how many hours are left until midnight there?"],
  ["Multi-step math", "Calculate (17 × 23 + 4) to the power of 2."],
  ["A tool fails", "What's the weather in Atlantis, the sunken city? If you can't find it, tell me the weather in Athens instead."],
];

export default function AgentDemo() {
  const [task, setTask] = useState(EXAMPLES[0][1]);
  const [events, setEvents] = useState([]); // everything runAgent() reported, in order
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const abortRef = useRef(null);

  async function run(event) {
    event.preventDefault();
    const controller = new AbortController();
    abortRef.current = controller;
    setEvents([]);
    setError("");
    setRunning(true);
    const startedAt = Date.now();
    try {
      // Each event arrives while the agent is still working on the server.
      await postForEvents("/api/agent", { task }, (agentEvent) => setEvents((previous) => [...previous, agentEvent]), {
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") {
        setEvents((previous) => [...previous, { type: "error", message: "Stopped by you." }]);
      } else {
        setError(err.message);
      }
    } finally {
      setRunning(false);
      setSeconds((Date.now() - startedAt) / 1000);
    }
  }

  const responses = events.filter((agentEvent) => agentEvent.type === "llm_response");
  const toolCalls = events.filter((agentEvent) => agentEvent.type === "tool_call").length;
  const tokensIn = responses.reduce((sum, response) => sum + response.usage.input_tokens, 0);
  const tokensOut = responses.reduce((sum, response) => sum + response.usage.output_tokens, 0);

  return (
    <div className="stack">
      <form onSubmit={run} className="card stack">
        <label>
          Task for the agent
          <textarea rows={3} value={task} onChange={(e) => setTask(e.target.value)} required />
        </label>
        <div className="row examples">
          <span className="hint">Try:</span>
          {EXAMPLES.map(([label, text]) => (
            <button key={label} type="button" className="secondary" onClick={() => setTask(text)} disabled={running}>
              {label}
            </button>
          ))}
        </div>
        <div className="row">
          <button disabled={running}>{running ? "Agent is working…" : "Run agent"}</button>
          {running && (
            <button type="button" className="secondary" onClick={() => abortRef.current?.abort()}>
              Stop
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {events.length > 0 && (
        <ol className="timeline">
          {events.map((agentEvent, index) => (
            <EventItem key={index} event={agentEvent} />
          ))}
          {running && <li className="muted">…</li>}
        </ol>
      )}

      {!running && responses.length > 0 && (
        <dl className="stats card">
          <dt>model calls</dt>
          <dd>{responses.length}</dd>
          <dt>tool calls</dt>
          <dd>{toolCalls}</dd>
          <dt>tokens</dt>
          <dd>
            {tokensIn} in · {tokensOut} out
          </dd>
          <dt>time</dt>
          <dd>{seconds.toFixed(1)} s</dd>
        </dl>
      )}
    </div>
  );
}

// One line of the timeline per event from lib/agent/run-agent.js.
function EventItem({ event }) {
  switch (event.type) {
    case "start":
      return (
        <li>
          <strong>Agent started</strong> · model <code>{event.model}</code> · tools: <code>{event.tools.join(", ")}</code>
        </li>
      );

    case "llm_request":
      return (
        <li className="ev-llm">
          <strong>Step {event.step}: asking Claude</strong>{" "}
          <span className="muted">
            (sending all {event.messageCount} {event.messageCount === 1 ? "message" : "messages"} so far)
          </span>
        </li>
      );

    case "llm_response": {
      const calls = event.content.filter((block) => block.type === "tool_use");
      const said = event.content.filter((block) => block.type !== "tool_use");
      return (
        <li className="ev-llm stack">
          <span className="tag">
            Claude replied · stop_reason: {event.stopReason} · {event.usage.input_tokens} tokens in /{" "}
            {event.usage.output_tokens} out
          </span>
          <ContentBlocks content={said} />
          {calls.length > 0 && (
            <span>
              → asks for {calls.length} tool {calls.length === 1 ? "call" : "calls"}:{" "}
              <code>{calls.map((call) => call.name).join(", ")}</code>
            </span>
          )}
        </li>
      );
    }

    case "tool_call":
      return (
        <li className="ev-tool">
          <span className="tag">your code runs</span>{" "}
          <code>
            {event.name}({JSON.stringify(event.input)})
          </code>
        </li>
      );

    case "tool_result":
      return (
        <li className="ev-tool">
          <ContentBlocks
            content={[{ type: "tool_result", tool_use_id: event.id, content: event.content, is_error: event.isError }]}
          />
        </li>
      );

    case "final":
      return (
        <li className="ev-final stack">
          <strong>Final answer</strong>
          {event.stopReason === "max_tokens" && <span className="notice">Cut off: the reply hit max_tokens.</span>}
          <div className="block block-text">{event.text}</div>
        </li>
      );

    case "refusal":
      return (
        <li className="ev-error">
          Claude declined this task{event.category ? ` (category: ${event.category})` : ""}.
        </li>
      );

    case "error":
      return <li className="ev-error">{event.message}</li>;

    default:
      return null;
  }
}
