import LessonHeader from "@/components/lesson-header";
import AgentDemo from "./agent-demo";

export const metadata = { title: "4 · Agent" };

const AGENT_LOOP = `messages = [task]
repeat (at most maxSteps times):
  reply = await claude(messages, tools)       // 1. think
  messages.push(reply)                        // 2. remember
  if (reply.stop_reason !== "tool_use")       // 3. done?
    return reply
  results = await run every tool it asked for // 4. act
  messages.push(results)                      // 5. show it the results`;

export default function AgentPage() {
  return (
    <div className="stack-lg">
      <LessonHeader
        number={4}
        title="Agent = the same loop, automated"
        files={[
          ["lib/agent/run-agent.js", "THE agent loop, about 40 lines of logic. Start here."],
          ["app/api/agent/route.js", "runs the loop on the server and streams every step"],
          ["app/agent/agent-demo.js", "this page, which draws each step as it arrives"],
          ["lib/agent/run-agent.test.js", "tests for the loop with a fake Claude (npm test)"],
        ]}
      >
        <p>
          In lesson 3 you ran the loop by hand: ask Claude, run the tools it asks for, send back the results, repeat
          until it answers. An <strong>agent</strong> is exactly that loop, written as code:
        </p>
        <pre className="code">{AGENT_LOOP}</pre>
        <ul>
          <li>The model makes the plan: which tools to call, in what order, and when it is done.</li>
          <li>
            Independent calls run in parallel. Dependent ones take extra steps: first the weather, then the math on
            it.
          </li>
          <li>
            A failed tool goes back to the model as an <code>is_error</code> result, so it can try something else.
          </li>
          <li>
            Guard rails: a step limit (<code>maxSteps</code>), a Stop button, and only the tools you chose to give it.
          </li>
        </ul>
      </LessonHeader>
      <AgentDemo />
    </div>
  );
}
