import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: { default: "LLM & Agents Lab", template: "%s · LLM & Agents Lab" },
  description: "Learn how LLMs, tools and agents work, step by step, with Next.js and Claude.",
};

const LESSONS = [
  ["/basics", "1 · Prompt"],
  ["/chat", "2 · Chat"],
  ["/tools", "3 · Tools"],
  ["/agent", "4 · Agent"],
];

// The root layout wraps every page: <html>, <body> and the navigation.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            LLM &amp; Agents Lab
          </Link>
          <nav>
            {LESSONS.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
