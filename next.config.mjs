/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The legacy prototype is kept for reference only and must never be compiled.
  outputFileTracingExcludes: {
    "*": ["./legacy/**/*"]
  }
};

export default nextConfig;
