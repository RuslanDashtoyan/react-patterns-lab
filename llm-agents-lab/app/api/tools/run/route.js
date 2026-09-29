// Lesson 3, "run a tool": execute one tool call on the server.
//
// The model never runs anything itself. It only asks; this is where your code acts.
// (Here the page picks which call to run so you can step through by hand. In the
// agent, lesson 4, the server does this on its own.)
import { runTool } from "@/lib/tools";

export async function POST(request) {
  const { name, input } = await request.json().catch(() => ({}));
  if (typeof name !== "string") {
    return Response.json({ error: "Which tool? Send { name, input }." }, { status: 400 });
  }
  return Response.json(await runTool(name, input ?? {}));
}
