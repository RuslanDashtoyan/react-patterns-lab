"use client"; // runs in the browser: it has state and reacts to clicks

import { useState } from "react";
import ContentBlocks from "@/components/content-blocks";
import JsonView from "@/components/json-view";
import { postJson } from "@/lib/http/browser";

export default function BasicsDemo() {
  const [system, setSystem] = useState("You are a patient teacher. Answer in at most three short sentences.");
  const [prompt, setPrompt] = useState("What is a large language model? Explain it to a JavaScript developer.");
  const [effort, setEffort] = useState("low");
  const [result, setResult] = useState(null); // { request, response } from app/api/basics/route.js
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const startedAt = performance.now();
    try {
      // Our own server route, not Anthropic: the browser has no API key.
      setResult(await postJson("/api/basics", { system, prompt, effort }));
      setElapsedMs(Math.round(performance.now() - startedAt));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const response = result?.response;

  return (
    <div className="stack">
      <form onSubmit={send} className="card stack">
        <label>
          <span>
            System prompt <span className="hint">(the rules for this conversation, optional)</span>
          </span>
          <textarea rows={2} value={system} onChange={(e) => setSystem(e.target.value)} />
        </label>
        <label>
          User prompt
          <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
        </label>
        <div className="row">
          <label>
            <span>
              Effort <span className="hint">(how much Claude thinks first)</span>
            </span>
            <select value={effort} onChange={(e) => setEffort(e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>
        <button disabled={loading}>{loading ? "Waiting for Claude…" : "Send"}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {response && (
        <section className="card stack">
          <h2>Answer</h2>
          {response.stop_reason === "refusal" ? (
            <p className="notice">Claude declined this request (stop_reason: refusal).</p>
          ) : (
            <ContentBlocks content={response.content} />
          )}
          <dl className="stats">
            <dt>stop_reason</dt>
            <dd>{response.stop_reason}</dd>
            <dt>input tokens</dt>
            <dd>{response.usage.input_tokens}</dd>
            <dt>output tokens</dt>
            <dd>{response.usage.output_tokens} (thinking included)</dd>
            <dt>time</dt>
            <dd>{(elapsedMs / 1000).toFixed(1)} s</dd>
            <dt>model</dt>
            <dd>{response.model}</dd>
          </dl>
          <JsonView label="The HTTP request our server sent to Anthropic" value={result.request} />
          <JsonView label="The raw JSON response Anthropic sent back" value={response} />
        </section>
      )}
    </div>
  );
}
