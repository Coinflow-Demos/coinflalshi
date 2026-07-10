import type {NextConfig} from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // This app lives inside an npm workspaces monorepo (packages/db is a
  // sibling workspace it imports). Without this, Next's file tracer can get
  // confused about which directory tree is the real project root — especially
  // if any parent directory happens to contain an unrelated lockfile — and
  // silently omit files needed by the serverless function bundle it ships to
  // Vercel.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
};

export default nextConfig;
