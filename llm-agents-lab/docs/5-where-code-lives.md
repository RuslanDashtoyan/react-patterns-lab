# 5. Where the code lives in a Next.js app

## Two places code runs

A Next.js app runs code in two places, and the most important rule of this project follows from that:

|                              | Server (Node.js on your machine or host)                                   | Browser (your visitor's computer)                              |
|------------------------------|----------------------------------------------------------------------------|----------------------------------------------------------------|
| Can read secrets in `process.env` | yes                                                                   | no                                                             |
| Can use `useState`, `onClick` | no                                                                        | yes                                                            |
| In this project              | `app/api/**/route.js`, the `page.js` files, `lib/llm`, `lib/http/server.js`, `lib/tools`, `lib/agent` | the `*-demo.js` files, the `components/` they use, `lib/http/browser.js` |

Anyone who opens a web page can read everything the browser downloaded. So the API key must stay on the server, and
pages call **your** routes, never Anthropic directly.

## Files Next.js treats specially

In `app/`, the folder path becomes the URL:

| File                     | Becomes                                                   | Runs on |
|--------------------------|-----------------------------------------------------------|---------|
| `app/page.js`            | the page `/`                                              | server  |
| `app/agent/page.js`      | the page `/agent`                                         | server  |
| `app/api/agent/route.js` | the endpoint `POST /api/agent` (its exported `POST` function) | server  |
| `app/layout.js`          | the frame around every page                               | server  |

Other files in `app/`, like `app/agent/agent-demo.js`, are ordinary modules, not routes. That lets you keep a page's
pieces in the page's folder.

## Server Components and Client Components

- **Server Components** are the default. They render to HTML on the server and may read secrets. `app/page.js` reads
  `process.env.ANTHROPIC_API_KEY` to show whether it is set; only that yes-or-no answer reaches the browser.
- **Client Components** start with `"use client"`. They run in the browser (after a first render on the server for the
  initial HTML), and can use state and event handlers. Each lesson's `*-demo.js` is one.

A Server Component can render a Client Component and pass it props, as long as they're plain data. `app/tools/page.js`
passes `TOOL_DEFINITIONS` into `<ToolsDemo />` this way.

## Three locks on the API key

1. **Environment variables.** The key lives in `.env.local`. Next.js loads it into `process.env` on the server.
   Variables *without* the `NEXT_PUBLIC_` prefix are never put into browser code, so never name it
   `NEXT_PUBLIC_ANTHROPIC_API_KEY`.
2. **`import "server-only"`.** `lib/llm/client.js` and `lib/http/server.js` start with this line. If a Client Component
   imports them, even indirectly, the build stops with:
   `'server-only' cannot be imported from a Client Component module`.
3. **Git.** `.env.local` is listed in `.gitignore`. Only `.env.example`, which holds no key, is committed.

The SDK adds a fourth: `new Anthropic()` refuses to run in a browser unless you pass `dangerouslyAllowBrowser: true`.

## Route Handlers are your backend

A `route.js` file exports functions named after HTTP methods. They receive a standard Web `Request` and return a
`Response`:

```js
// app/api/tools/run/route.js
export async function POST(request) {
  const { name, input } = await request.json().catch(() => ({}));
  if (typeof name !== "string") {
    return Response.json({ error: "Which tool? Send { name, input }." }, { status: 400 });
  }
  return Response.json(await runTool(name, input ?? {}));
}
```

To stream, return a `Response` whose body is a `ReadableStream`. `streamEvents()` in `lib/http/server.js` builds one.

## Why `lib/` is plain JavaScript

The tools and the agent loop import neither React nor Next.js, and they use relative imports
(`../tools/index.js`) instead of the `@/` alias, which only Next.js understands (it is defined in `jsconfig.json`). So
plain Node can run them, and `npm test` (Node's built-in test runner) checks them in well under a second.

Route handlers stay thin: read the request, call something in `lib/`, return the result.

## Checklist: adding an LLM feature

1. **The logic** that calls the model goes in a function in `lib/`. Pass the SDK client in as a parameter if you want
   to test it with a fake one.
2. **An endpoint** for the browser goes in `app/api/<name>/route.js`, which calls that function with `getAnthropic()`.
3. **The UI** is a Client Component (`"use client"`) that calls the endpoint with `postJson()` or `postForEvents()`.
4. **A new secret** goes in `.env.local` (with an empty line for it in `.env.example`), and only server code reads it.

Back to the [README](../README.md)
