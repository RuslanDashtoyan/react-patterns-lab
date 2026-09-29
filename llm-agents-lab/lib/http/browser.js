// Helpers our pages use to call our own Route Handlers (app/api/**/route.js).
// The browser never talks to Anthropic directly: it has no API key.

// POST JSON and get JSON back. Throws with the server's error message.
export async function postJson(url, body, { signal } = {}) {
  const response = await post(url, body, signal);
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw new Error(data?.error ?? `Request to ${url} failed (HTTP ${response.status})`);
  }
  return data;
}

// POST JSON, then call onEvent(event) for every line the server streams back
// (see streamEvents in lib/http/server.js). Resolves when the stream ends.
export async function postForEvents(url, body, onEvent, { signal } = {}) {
  const response = await post(url, body, signal);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Request to ${url} failed (HTTP ${response.status})`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += value;
    const lines = buffered.split("\n");
    buffered = lines.pop(); // the last piece may be half a line: keep it for the next chunk
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line));
    }
  }
  if (buffered.trim()) onEvent(JSON.parse(buffered));
}

function post(url, body, signal) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}
