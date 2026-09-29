import LessonHeader from "@/components/lesson-header";
import ChatDemo from "./chat-demo";

export const metadata = { title: "2 · Chat" };

export default function ChatPage() {
  return (
    <div className="stack-lg">
      <LessonHeader
        number={2}
        title="Chat = send the whole conversation again"
        files={[
          ["app/chat/chat-demo.js", "keeps the conversation in React state and sends all of it every time"],
          ["app/api/chat/route.js", "streams Claude's reply back as it is written"],
          ["lib/http/server.js", "streamEvents(): the server side of streaming, one JSON line per event"],
          ["lib/http/browser.js", "postForEvents(): the browser side, reads those lines as they arrive"],
        ]}
      >
        <p>
          The model has <strong>no memory</strong>: every request stands alone. A &quot;chat&quot; is your code keeping
          an array of messages and sending <em>all of it</em> each time, with the new message at the end.
        </p>
        <ul>
          <li>
            Tell it your name, then ask what your name is. It knows only because the earlier messages were sent
            again. Press <em>New conversation</em> and ask once more.
          </li>
          <li>
            Watch <em>input tokens</em> grow every turn. Long chats cost more, and at some point hit the model&apos;s
            context window (the most text it can read at once).
          </li>
          <li>
            <em>Streaming</em>: the server forwards each piece of text as soon as Claude writes it, so the reply
            appears word by word instead of after a long wait.
          </li>
        </ul>
      </LessonHeader>
      <ChatDemo />
    </div>
  );
}
