import LessonHeader from "@/components/lesson-header";
import BasicsDemo from "./basics-demo";

export const metadata = { title: "1 · One prompt, one answer" };

// page.js is a Server Component: static explanation rendered on the server.
// The interactive part lives in basics-demo.js ("use client").
export default function BasicsPage() {
  return (
    <div className="stack-lg">
      <LessonHeader
        number={1}
        title="One prompt → one answer"
        files={[
          ["app/basics/basics-demo.js", "the form, runs in the browser"],
          ["app/api/basics/route.js", "calls Claude, runs on the server"],
          ["lib/llm/client.js", "the SDK client, the only code that touches the API key"],
          ["lib/llm/config.js", "the model name and settings every request shares"],
        ]}
      >
        <p>
          At its core an LLM is a function: <strong>text in → text out</strong>. It writes its answer one{" "}
          <em>token</em> (a word or piece of a word) at a time, each time predicting what comes next. You send a list
          of <em>messages</em>; it replies with a list of <em>content blocks</em>.
        </p>
        <ul>
          <li>
            <code>stop_reason</code> says why it stopped: <code>end_turn</code> = finished, <code>max_tokens</code>{" "}
            = hit your length limit.
          </li>
          <li>
            <code>usage</code> counts tokens in and out. That is what you pay for.
          </li>
          <li>
            The <em>system prompt</em> sets the rules (tone, length, role) without being part of the conversation.
          </li>
          <li>
            Claude thinks before it answers. <em>Effort</em> sets how much: compare <code>low</code> and{" "}
            <code>high</code> on the same question and watch the time and output tokens.
          </li>
          <li>Open the raw request below: the API key never reaches your browser.</li>
        </ul>
      </LessonHeader>
      <BasicsDemo />
    </div>
  );
}
