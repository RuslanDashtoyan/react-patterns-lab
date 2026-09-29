// THE AGENT LOOP
//
// An "agent" is an LLM that may call tools, in a loop, until the task is done:
//
//   messages = [the user's task]
//   repeat:
//     response = ask the model(messages, tools)        1. think
//     messages.push(response)                           2. remember what it said
//     if it did not ask for a tool: stop                3. done?
//     results = run every tool it asked for             4. act
//     messages.push(results)                            5. show it the results
//
// That is the whole idea. Everything else below is reporting progress (onEvent)
// so the page can show you each step as it happens.

import { COMMON_PARAMS } from "../llm/config.js";
import { TOOL_DEFINITIONS, runTool } from "../tools/index.js";

// Request settings for tool use. Lesson 3 (you run the loop by clicking) and
// lesson 4 (this code runs it) both send these, so the ONLY difference between
// the two lessons is who runs the loop.
export const TOOL_USE_PARAMS = {
  ...COMMON_PARAMS,
  max_tokens: 16000,
  system:
    "You are a helpful assistant with tools. Use a tool whenever it gives a more reliable answer " +
    "than your memory: the current date or time, live weather, and every calculation. " +
    "When several tool calls don't depend on each other, make them in parallel. " +
    "When you have everything you need, give a short, direct final answer.",
  tools: TOOL_DEFINITIONS,
  // Claude thinks before it answers. "summarized" returns a readable summary of
  // that thinking, so you can watch the agent plan.
  thinking: { type: "adaptive", display: "summarized" },
  // How much to think: "low" | "medium" | "high" | "xhigh" | "max".
  output_config: { effort: "medium" },
};

/**
 * Runs one task to completion.
 *
 * @param {object}   options
 * @param {object}   options.client    Anthropic SDK client. Passed in, so tests can use a fake one.
 * @param {string}   options.task      What the user wants done.
 * @param {Function} [options.onEvent] Called with a progress event at every step.
 * @param {number}   [options.maxSteps] Safety limit on model calls.
 * @param {AbortSignal} [options.signal] Aborts the run (e.g. the Stop button).
 */
export async function runAgent({ client, task, onEvent = () => {}, maxSteps = 10, signal }) {
  const messages = [{ role: "user", content: task }];
  onEvent({ type: "start", model: COMMON_PARAMS.model, tools: TOOL_DEFINITIONS.map((tool) => tool.name) });

  for (let step = 1; step <= maxSteps; step++) {
    // 1. Ask the model. It has no memory, so it gets the WHOLE conversation every time.
    onEvent({ type: "llm_request", step, messageCount: messages.length });
    const response = await client.beta.messages.create({ ...TOOL_USE_PARAMS, messages }, { signal });
    onEvent({
      type: "llm_response",
      step,
      stopReason: response.stop_reason,
      content: response.content,
      usage: response.usage,
      model: response.model,
    });

    // 2. Remember its reply exactly as received. Only ever append to the
    //    history, never edit it: thinking blocks carry a signature that is
    //    checked when they come back.
    messages.push({ role: "assistant", content: response.content });

    // 3. Stop unless it asked for tools.
    if (response.stop_reason === "refusal") {
      onEvent({ type: "refusal", category: response.stop_details?.category ?? null });
      return { status: "refused", messages };
    }
    if (response.stop_reason !== "tool_use") {
      // "end_turn" = finished. "max_tokens" = ran out of room mid-answer.
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n\n");
      onEvent({ type: "final", text, stopReason: response.stop_reason });
      return { status: "done", text, messages };
    }

    // 4. Run every tool it asked for. They don't depend on each other, so run them in parallel.
    const toolCalls = response.content.filter((block) => block.type === "tool_use");
    const toolResults = await Promise.all(
      toolCalls.map(async (call) => {
        onEvent({ type: "tool_call", step, id: call.id, name: call.name, input: call.input });
        const { content, isError } = await runTool(call.name, call.input);
        onEvent({ type: "tool_result", step, id: call.id, name: call.name, content, isError });
        return { type: "tool_result", tool_use_id: call.id, content, is_error: isError };
      }),
    );

    // 5. Send ALL results back in ONE user message, then loop to step 1.
    messages.push({ role: "user", content: toolResults });
  }

  onEvent({ type: "error", message: `Stopped after ${maxSteps} steps without a final answer.` });
  return { status: "max_steps", messages };
}
