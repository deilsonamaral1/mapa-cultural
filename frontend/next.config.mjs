/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mesmo proxy do netlify.toml, para funcionar também no `npm run dev`.
  async rewrites() {
    return [
      { source: "/proxy/aquiraz/:path*", destination: "https://mapacultural.aquiraz.ce.gov.br/:path*" },
      { source: "/proxy/estado/:path*", destination: "https://mapacultural.secult.ce.gov.br/:path*" },
    ];
  },
};

export default nextConfig;
