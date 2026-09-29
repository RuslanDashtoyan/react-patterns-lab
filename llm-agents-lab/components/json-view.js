// Collapsible, pretty-printed JSON, for looking at raw API requests and responses.
export default function JsonView({ label, value, open = false }) {
  return (
    <details className="json-view" open={open}>
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
