"use client";

import { useState } from "react";
import JsonView from "@/components/json-view";
import { postForEvents } from "@/lib/http/browser";

export default function ChatDemo() {
  // The conversation, in exactly the shape the API expects: [{ role, content }].
  // This array IS the chat's memory. The model itself remembers nothing.
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState(null); // the reply arriving right now, or null
  const [lastTurn, setLastTurn] = useState(null); // numbers about the last reply
  const [error, setError] = useState("");

  const busy = streamingText !== null;

  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setDraft("");
    setError("");
    setStreamingText("");

    let reply = "";
    try {
      // Send the WHOLE history, then handle each event as the server streams it.
      await postForEvents("/api/chat", { messages: history }, (streamEvent) => {
        if (streamEvent.type === "text") {
          reply += streamEvent.text;
          setStreamingText(reply);
        } else if (streamEvent.type === "done") {
          setLastTurn({ ...streamEvent, sentMessages: history.length });
          if (streamEvent.stopReason === "refusal") {
            setError("Claude declined to answer that message.");
          } else {
            setMessages([...history, { role: "assistant", content: reply }]);
          }
        } else if (streamEvent.type === "error") {
          setError(streamEvent.message);
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setStreamingText(null);
    }
  }

  function startOver() {
    setMessages([]);
    setLastTurn(null);
    setError("");
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div className="chat">
          {messages.length === 0 && !busy && (
            <p className="muted">Say hi. Try telling it your name, and ask about it a few messages later.</p>
          )}
          {messages.map((message, index) => (
            <Bubble key={index} role={message.role} text={message.content} />
          ))}
          {busy && <Bubble role="assistant" text={streamingText || "…"} />}
        </div>

        <form onSubmit={send} className="row">
          <input
            className="grow"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            aria-label="Message"
          />
          <button disabled={busy || !draft.trim()}>Send</button>
          <button type="button" className="secondary" onClick={startOver} disabled={busy}>
            New conversation
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      {lastTurn && (
        <dl className="stats card">
          <dt>messages sent</dt>
          <dd>{lastTurn.sentMessages} (the whole history)</dd>
          <dt>input tokens</dt>
          <dd>{lastTurn.usage.input_tokens}</dd>
          <dt>output tokens</dt>
          <dd>{lastTurn.usage.output_tokens}</dd>
          <dt>stop_reason</dt>
          <dd>{lastTurn.stopReason}</dd>
        </dl>
      )}

      <JsonView
        label={`The conversation array, sent in full with your next message (${messages.length} messages)`}
        value={messages}
        open
      />
    </div>
  );
}

function Bubble({ role, text }) {
  return (
    <div className={`bubble ${role}`}>
      <span className="who">{role}</span>
      {text}
    </div>
  );
}
