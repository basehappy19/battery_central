import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
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
    // geolocation is now allowed for this origin only — Feature 11 uses
    // navigator.geolocation from the dashboard to record a device's
    // location, which the previous geolocation=() blocked outright.
    value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()",
  },
];

// /share/[token] is the public embed widget (Feature 14) — it's meant to be
// loaded inside an <iframe> on a third-party page, so it must NOT get the
// site-wide X-Frame-Options: SAMEORIGIN below (that would make every embed
// blank). Every other route keeps the full header set.
const nonEmbedSecurityHeaders = securityHeaders;
const embedSecurityHeaders = securityHeaders.filter((h) => h.key !== "X-Frame-Options");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/((?!share).*)",
        headers: nonEmbedSecurityHeaders,
      },
      {
        source: "/share/:path*",
        headers: embedSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
