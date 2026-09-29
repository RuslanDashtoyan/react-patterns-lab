// A tool has two halves:
//   definition: what the MODEL reads (name, description, JSON Schema for the input)
//   run:        what YOUR CODE does when the model asks for it
//
// LLMs predict text, so they can get arithmetic subtly wrong. A calculator tool
// makes the answer exact.

export const calculator = {
  definition: {
    name: "calculator",
    description:
      "Exact arithmetic on two numbers. Use it for every calculation instead of doing math in your head. " +
      "For longer expressions, call it once per step.",
    input_schema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide", "power"],
        },
        a: { type: "number", description: "First operand" },
        b: { type: "number", description: "Second operand" },
      },
      required: ["operation", "a", "b"],
      additionalProperties: false,
    },
    // strict: the API guarantees the model's input matches the schema exactly.
    strict: true,
  },

  run({ operation, a, b }) {
    switch (operation) {
      case "add":
        return { result: a + b };
      case "subtract":
        return { result: a - b };
      case "multiply":
        return { result: a * b };
      case "divide":
        if (b === 0) throw new Error("Cannot divide by zero.");
        return { result: a / b };
      case "power":
        return { result: a ** b };
      default:
        throw new Error(`Unknown operation "${operation}".`);
    }
  },
};
