import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This folder can live inside another repository that has its own lockfile.
  // Pin Turbopack's root here so the parent repo isn't treated as the project.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
