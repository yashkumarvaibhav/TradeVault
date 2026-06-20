import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Trade attachments allow up to 5 MB; give server actions headroom above that.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

const canUploadSentrySourceMaps = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN
  && process.env.SENTRY_AUTH_TOKEN
  && process.env.SENTRY_ORG
  && process.env.SENTRY_PROJECT,
);

export default canUploadSentrySourceMaps
  ? withSentryConfig(nextConfig, {
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
    })
  : nextConfig;
