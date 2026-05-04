import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin workspace root so Turbopack does not pick a parent folder when multiple lockfiles exist.
  turbopack: { root: projectRoot },
};

export default nextConfig;

