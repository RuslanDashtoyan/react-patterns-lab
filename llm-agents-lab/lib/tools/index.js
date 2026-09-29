// The tool registry: the one place that lists which tools the model may use.
// To add a tool: write a file like calculator.js and add it to TOOLS.
import { calculator } from "./calculator.js";
import { getCurrentTime } from "./get-current-time.js";
import { getWeather } from "./get-weather.js";

const TOOLS = [getCurrentTime, getWeather, calculator];

// Sent to the model with every request. This is ALL the model knows about
// your tools, so the descriptions matter: they are prompts.
export const TOOL_DEFINITIONS = TOOLS.map((tool) => tool.definition);

// Runs the tool the model asked for. Never throws: a failure becomes an
// error result that goes back to the model, which can then try something else.
export async function runTool(name, input) {
  const tool = TOOLS.find((candidate) => candidate.definition.name === name);
  if (!tool) {
    return { content: `There is no tool named "${name}".`, isError: true };
  }
  try {
    const output = await tool.run(input);
    return { content: JSON.stringify(output), isError: false };
  } catch (error) {
    return { content: error instanceof Error ? error.message : String(error), isError: true };
  }
}
