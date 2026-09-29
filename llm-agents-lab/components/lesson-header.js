// Title, explanation and "files to open" list shown at the top of every lesson.
// A Server Component: no "use client", so it renders on the server to plain HTML.
export default function LessonHeader({ number, title, files, children }) {
  return (
    <header className="lesson-header stack">
      <p className="eyebrow">Lesson {number} of 4</p>
      <h1>{title}</h1>
      {children}
      <details className="files" open>
        <summary>Open these files in WebStorm while you try it</summary>
        <ul>
          {files.map(([path, role]) => (
            <li key={path}>
              <code>{path}</code>: {role}
            </li>
          ))}
        </ul>
      </details>
    </header>
  );
}
