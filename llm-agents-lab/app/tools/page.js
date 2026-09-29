import LessonHeader from "@/components/lesson-header";
import { TOOL_DEFINITIONS } from "@/lib/tools";
import ToolsDemo from "./tools-demo";

export const metadata = { title: "3 · Tools" };

// Server Component: it imports the tool registry on the server and passes only
// the definitions (plain JSON) down to the browser component as a prop.
export default function ToolsPage() {
  return (
    <div className="stack-lg">
      <LessonHeader
        number={3}
        title="Tools: the model asks, your code acts"
        files={[
          ["lib/tools/*.js", "each tool: a definition for the model plus a run() function for your code"],
          ["lib/tools/index.js", "the registry: TOOL_DEFINITIONS and runTool()"],
          ["app/api/tools/step/route.js", "asks Claude, sending the tool definitions along"],
          ["app/api/tools/run/route.js", "runs one tool call on the server"],
          ["app/tools/tools-demo.js", "this page, where you decide when tools run"],
        ]}
      >
        <p>
          An LLM can only write text. It can&apos;t read a clock, call an API or do exact math. So you{" "}
          <em>describe</em> tools to it: a name, a description and a JSON Schema for the input. When a tool would help,
          the model answers with a <code>tool_use</code> block instead of a final answer and stops with{" "}
          <code>stop_reason: &quot;tool_use&quot;</code>. <strong>Your code</strong> runs the tool and sends back a{" "}
          <code>tool_result</code>. Then the model carries on.
        </p>
        <p>
          On this page <strong>you are the loop</strong>: click to run each tool, then click to send the results back.
        </p>
        <ul>
          <li>
            Several <code>tool_use</code> blocks in one reply are parallel calls. All their results go back together
            in one message.
          </li>
          <li>
            Each <code>tool_result</code> points to its <code>tool_use</code> by id.
          </li>
          <li>
            The model sees only the definitions at the bottom of the page. Their descriptions act as prompts: they
            decide when a tool gets used.
          </li>
        </ul>
      </LessonHeader>
      <ToolsDemo toolDefinitions={TOOL_DEFINITIONS} />
    </div>
  );
}
