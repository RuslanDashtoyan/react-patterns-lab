// Babel config used ONLY by Jest to transform TS/JSX into plain JS for Node.
// (Vite handles this itself for the real app/build — this file doesn't affect `pnpm dev`/`pnpm build`.)
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }],
    "@babel/preset-typescript",
  ],
};
