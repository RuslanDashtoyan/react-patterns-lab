// The model has no clock: it only knows what was in its training data and in
// the conversation. This tool gives it the real current time.

export const getCurrentTime = {
  definition: {
    name: "get_current_time",
    description:
      "Get the current date and time in an IANA time zone such as 'Asia/Tokyo' or 'Europe/Paris'. " +
      "Use it whenever the answer depends on today's date or the current time; you cannot know it otherwise.",
    input_schema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA time zone name, e.g. 'America/New_York' or 'Europe/Berlin'",
        },
      },
      required: ["timezone"],
      additionalProperties: false,
    },
    strict: true,
  },

  run({ timezone }) {
    const now = new Date();
    let localTime;
    try {
      localTime = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        dateStyle: "full",
        timeStyle: "long",
        hourCycle: "h23",
      }).format(now);
    } catch {
      // Thrown errors go back to the model as an error result, so it can retry.
      throw new Error(`Unknown time zone "${timezone}". Use an IANA name such as "Europe/Paris".`);
    }
    return { timezone, local_time: localTime, utc: now.toISOString() };
  },
};
