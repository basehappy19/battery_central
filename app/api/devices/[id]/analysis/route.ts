import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyDashboardAuth } from '@/lib/security';
import { logApiRequest } from '@/lib/api-logger';
import { computeHealthScore, computeChargingProfile } from '@/lib/analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Feature 5 (Battery Health Score) + Feature 12 (Charging Profile Analysis).
// Deliberately a separate, on-demand endpoint rather than being bundled into
// GET /api/devices — that endpoint is polled every few seconds by the
// dashboard, and running this analysis over weeks of logs on every poll
// would be wasteful. The frontend calls this only when a device card is
// expanded / its analysis tab is opened.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const startTime = Date.now();
  const { id } = await ctx.params;
  const path = `/api/devices/${id}/analysis`;
  try {
    const isAuthed = await verifyDashboardAuth(request);
    if (!isAuthed) {
      logApiRequest({ method: 'GET', path, status: 401, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Unauthorized' } });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const daysParam = Number(request.nextUrl.searchParams.get('days')) || 30;
    const days = Math.min(90, Math.max(3, daysParam));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      logApiRequest({ method: 'GET', path, status: 404, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Device Not Found' } });
      return NextResponse.json({ error: 'Device Not Found' }, { status: 404 });
    }

    const logs = await prisma.batteryLog.findMany({
      where: { deviceId: id, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 20000,
    });

    const health = computeHealthScore(logs, days, device.lowBatteryThreshold ?? 20);
    const chargingProfile = computeChargingProfile(logs, days);

    const resBody = { deviceId: id, deviceName: device.name, health, chargingProfile };
    logApiRequest({ method: 'GET', path, status: 200, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { success: true, score: health.score } });
    return NextResponse.json(resBody, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Failed to compute device analysis:', error);
    logApiRequest({ method: 'GET', path, status: 500, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
