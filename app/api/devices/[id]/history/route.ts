import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyDashboardAuth } from '@/lib/security';
import { logApiRequest } from '@/lib/api-logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Feature 2: multi-day battery history graph. ?days=1|7|30 (default 7).
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const startTime = Date.now();
  const { id } = await ctx.params;
  const path = `/api/devices/${id}/history`;
  try {
    const isAuthed = await verifyDashboardAuth(request);
    if (!isAuthed) {
      logApiRequest({ method: 'GET', path, status: 401, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Unauthorized' } });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const daysParam = Number(request.nextUrl.searchParams.get('days')) || 7;
    const days = Math.min(90, Math.max(1, daysParam));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      logApiRequest({ method: 'GET', path, status: 404, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Device Not Found' } });
      return NextResponse.json({ error: 'Device Not Found' }, { status: 404 });
    }

    const logs = await prisma.batteryLog.findMany({
      where: { deviceId: id, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 10000,
    });

    const points = logs.map((l) => ({
      time: l.createdAt.toISOString(),
      level: l.batteryLevel,
      isCharging: l.isCharging,
      eventType: l.eventType,
    }));

    if (points.length === 0 || points[points.length - 1].time !== device.updatedAt.toISOString()) {
      points.push({
        time: device.updatedAt.toISOString(),
        level: device.batteryLevel,
        isCharging: device.isCharging,
        eventType: 'CURRENT',
      });
    }

    const resBody = { deviceId: id, deviceName: device.name, days, points };
    logApiRequest({ method: 'GET', path, status: 200, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { success: true, count: points.length } });
    return NextResponse.json(resBody, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Failed to fetch device history:', error);
    logApiRequest({ method: 'GET', path, status: 500, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
