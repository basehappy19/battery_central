import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security';

// Feature 15: API rate limiting.
//
// Note for maintainers: Next.js 16 renamed the `middleware.ts` convention to
// `proxy.ts` (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// This file is the direct replacement — same execution model, same
// NextRequest/NextResponse APIs, just a new filename and export name.
//
// lib/security.ts already had an in-memory checkRateLimit() helper that
// wasn't wired up anywhere; this is the first thing that actually calls it.
// It's a single-process in-memory limiter (a Map), which is fine for this
// app's typical single-instance deployment but will not share state across
// multiple server instances behind a load balancer.

const GENERAL_LIMIT = Number(process.env.RATE_LIMIT_MAX) || 120; // requests
const GENERAL_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000; // per minute

// The device ingestion endpoint gets its own, slightly more generous bucket
// so a handful of IoT devices behind the same NAT/router don't trip the
// general dashboard/API limit.
const BATTERY_UPDATE_LIMIT = Number(process.env.RATE_LIMIT_BATTERY_MAX) || 180;
const BATTERY_UPDATE_WINDOW_MS = Number(process.env.RATE_LIMIT_BATTERY_WINDOW_MS) || 60_000;

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  if (pathname.startsWith('/api/battery/update')) {
    const result = checkRateLimit(`battery:${ip}`, BATTERY_UPDATE_LIMIT, BATTERY_UPDATE_WINDOW_MS);
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(BATTERY_UPDATE_WINDOW_MS / 1000)) } }
      );
    }
  } else {
    const result = checkRateLimit(`api:${ip}`, GENERAL_LIMIT, GENERAL_WINDOW_MS);
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(GENERAL_WINDOW_MS / 1000)) } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
