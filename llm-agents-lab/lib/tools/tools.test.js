// Tools are ordinary functions: test them like any other code. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTool, TOOL_DEFINITIONS } from "./index.js";

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("every definition is a valid strict tool", () => {
  for (const definition of TOOL_DEFINITIONS) {
    assert.match(definition.name, /^[a-z_]+$/);
    assert.ok(definition.description.length > 20, `${definition.name} needs a real description`);
    assert.equal(definition.strict, true);
    assert.equal(definition.input_schema.additionalProperties, false);
    assert.deepEqual(
      [...definition.input_schema.required].sort(),
      Object.keys(definition.input_schema.properties).sort(),
    );
  }
});

test("calculator does exact arithmetic", async () => {
  assert.deepEqual(await runTool("calculator", { operation: "multiply", a: 1234, b: 5678 }), {
    content: '{"result":7006652}',
    isError: false,
  });
  assert.deepEqual(await runTool("calculator", { operation: "power", a: 2, b: 10 }), {
    content: '{"result":1024}',
    isError: false,
  });
});

test("calculator reports division by zero as an error result", async () => {
  assert.deepEqual(await runTool("calculator", { operation: "divide", a: 1, b: 0 }), {
    content: "Cannot divide by zero.",
    isError: true,
  });
});

test("get_current_time returns the time in the requested zone", async () => {
  const { content, isError } = await runTool("get_current_time", { timezone: "Asia/Tokyo" });
  assert.equal(isError, false);
  const output = JSON.parse(content);
  assert.equal(output.timezone, "Asia/Tokyo");
  assert.match(output.local_time, /\d{4}/); // contains the year
  assert.ok(!Number.isNaN(Date.parse(output.utc)));
});

test("get_current_time rejects an unknown zone so the model can retry", async () => {
  const { content, isError } = await runTool("get_current_time", { timezone: "Mars/Olympus_Mons" });
  assert.equal(isError, true);
  assert.match(content, /Unknown time zone/);
});

test("get_weather geocodes the city, then reads the current weather", async (t) => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(String(url));
    return urls.length === 1
      ? jsonResponse({
          results: [
            { name: "São Paulo", country: "Brazil", latitude: -23.55, longitude: -46.63, timezone: "America/Sao_Paulo" },
          ],
        })
      : jsonResponse({ current: { time: "2026-09-29T08:00", temperature_2m: 21.4, wind_speed_10m: 7.2, weather_code: 2 } });
  });

  const { content, isError } = await runTool("get_weather", { city: "São Paulo" });

  assert.equal(isError, false);
  assert.deepEqual(JSON.parse(content), {
    city: "São Paulo",
    country: "Brazil",
    timezone: "America/Sao_Paulo",
    temperature_c: 21.4,
    wind_kmh: 7.2,
    conditions: "partly cloudy",
  });
  // The city name is URL-encoded: the space and the "ã" can't go into a URL as-is.
  assert.equal(urls[0], "https://geocoding-api.open-meteo.com/v1/search?name=S%C3%A3o%20Paulo&count=1");
  assert.match(urls[1], /latitude=-23\.55&longitude=-46\.63&current=temperature_2m,wind_speed_10m,weather_code$/);
});

test("get_weather reports an unknown city as an error result", async (t) => {
  t.mock.method(globalThis, "fetch", async () => jsonResponse({ generationtime_ms: 0.4 })); // no "results" key

  assert.deepEqual(await runTool("get_weather", { city: "Atlantis" }), {
    content: 'No city found named "Atlantis".',
    isError: true,
  });
});

test("get_weather reports a failing weather service as an error result", async (t) => {
  t.mock.method(globalThis, "fetch", async () => jsonResponse({ reason: "down" }, 503));

  assert.deepEqual(await runTool("get_weather", { city: "Paris" }), {
    content: "Weather service answered HTTP 503.",
    isError: true,
  });
});

test("an unknown tool name is an error result, not a crash", async () => {
  assert.deepEqual(await runTool("launch_rocket", {}), {
    content: 'There is no tool named "launch_rocket".',
    isError: true,
  });
});
