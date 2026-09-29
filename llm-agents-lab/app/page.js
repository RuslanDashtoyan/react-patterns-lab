import Link from "next/link";
import { connection } from "next/server";
import { MODEL } from "@/lib/llm/config";

const LESSONS = [
  {
    href: "/basics",
    title: "One prompt → one answer",
    text: "An LLM is a function: text in, text out. See the tokens, the stop reason and the raw HTTP request.",
  },
  {
    href: "/chat",
    title: "Chat = send the whole conversation again",
    text: "The model remembers nothing. Your code keeps the history, and the reply streams in word by word.",
  },
  {
    href: "/tools",
    title: "Tools: the model asks, your code acts",
    text: "Step through tool use by hand. You run each tool the model asks for and send back the result.",
  },
  {
    href: "/agent",
    title: "Agent = the same loop, automated",
    text: "A loop runs tools until the task is done. Watch every step of the agent live.",
  },
];

// A Server Component (no "use client"): this function runs on the server, so it
// may read process.env. Only the rendered HTML reaches the browser, not the key.
export default async function HomePage() {
  await connection(); // render on every request, so the key check below is always current
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="stack-lg">
      <section className="stack">
        <h1>How LLMs and agents work, step by step</h1>
        <p className="lead">
          Four small lessons, each a working page backed by real, commented code. Every lesson lists the files
          involved, so keep WebStorm open next to the browser.
        </p>
        {hasKey ? (
          <p className="status ok">
            API key found. Model: <code>{MODEL}</code>
          </p>
        ) : (
          <p className="status warn">
            No API key yet. Copy <code>.env.example</code> to <code>.env.local</code>, paste your key, then restart{" "}
            <code>npm run dev</code>.
          </p>
        )}
      </section>

      <section className="stack">
        <h2>The big picture</h2>
        <div className="flow">
          <div className="flow-box">
            <strong>Browser</strong>
            <span>
              <code>app/…/*-demo.js</code>
            </span>
            <span>&quot;use client&quot; components</span>
          </div>
          <div className="flow-arrow">
            <code>fetch(&quot;/api/…&quot;)</code>
          </div>
          <div className="flow-box">
            <strong>Your Next.js server</strong>
            <span>
              <code>app/api/…/route.js</code>
            </span>
            <span>holds the API key</span>
          </div>
          <div className="flow-arrow">HTTPS</div>
          <div className="flow-box">
            <strong>Anthropic API</strong>
            <span>
              <code>POST /v1/messages</code>
            </span>
            <span>Claude writes the reply</span>
          </div>
        </div>
        <p>
          The browser never talks to Claude directly: it would need your API key, and anyone can read what a web page
          downloads. So pages call <em>your</em> server, and only your server calls Claude.
        </p>
      </section>

      <section className="stack">
        <h2>Lessons</h2>
        <ol className="lesson-list">
          {LESSONS.map((lesson, index) => (
            <li key={lesson.href}>
              <Link href={lesson.href} className="lesson-card">
                <span className="lesson-number">{index + 1}</span>
                <span>
                  <strong>{lesson.title}</strong>
                  <span className="muted">{lesson.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="muted">
          Longer explanations are in the <code>docs/</code> folder of the project.
        </p>
      </section>
    </div>
  );
}
