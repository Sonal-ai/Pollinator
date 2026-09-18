import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ── Security Headers ──────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },

  // ── Webpack: handle Node-only modules used in server routes ──
  webpack(config) {
    // geoip-lite uses a .dat file which webpack can't bundle — mark as external
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "geoip-lite",
    ];
    return config;
  },

  // ── Logging ──────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
