// Renders the `content` of an API message. A message is not one string but a
// list of typed blocks: text, thinking, tool_use, tool_result, ...
export default function ContentBlocks({ content }) {
  if (typeof content === "string") {
    return <div className="block block-text">{content}</div>;
  }
  return content.map((block, index) => <Block key={index} block={block} />);
}

function Block({ block }) {
  switch (block.type) {
    case "text":
      return <div className="block block-text">{block.text}</div>;

    case "thinking":
      // Empty when the request didn't ask for display: "summarized".
      if (!block.thinking) return null;
      return (
        <div className="block block-thinking">
          <span className="tag">thinking (summary)</span>
          {block.thinking}
        </div>
      );

    case "tool_use":
      return (
        <div className="block block-tool">
          <span className="tag">tool_use · id {block.id}</span>
          <code>
            {block.name}({JSON.stringify(block.input)})
          </code>
        </div>
      );

    case "tool_result":
      return (
        <div className={`block block-result${block.is_error ? " is-error" : ""}`}>
          <span className="tag">
            tool_result{block.is_error ? " (error)" : ""} · for {block.tool_use_id}
          </span>
          <code>{typeof block.content === "string" ? block.content : JSON.stringify(block.content)}</code>
        </div>
      );

    case "fallback":
      return (
        <div className="block notice">
          {block.from.model} declined this request, so {block.to.model} answered instead.
        </div>
      );

    case "redacted_thinking":
      return null;

    default:
      return (
        <div className="block">
          <span className="tag">{block.type}</span>
        </div>
      );
  }
}
