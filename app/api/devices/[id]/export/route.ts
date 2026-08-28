import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyDashboardAuth } from '@/lib/security';
import { logApiRequest } from '@/lib/api-logger';
import { toCsv } from '@/lib/csv';
import { BATTERY_LOG_RETENTION_DAYS } from '@/lib/retention';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Feature 3: export a device's BatteryLog history as CSV. ?days=N (default:
// full retention window, currently 90 days).
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const startTime = Date.now();
  const { id } = await ctx.params;
  const path = `/api/devices/${id}/export`;
  try {
    const isAuthed = await verifyDashboardAuth(request);
    if (!isAuthed) {
      logApiRequest({ method: 'GET', path, status: 401, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Unauthorized' } });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const daysParam = Number(request.nextUrl.searchParams.get('days')) || BATTERY_LOG_RETENTION_DAYS;
    const days = Math.min(BATTERY_LOG_RETENTION_DAYS, Math.max(1, daysParam));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      logApiRequest({ method: 'GET', path, status: 404, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Device Not Found' } });
      return NextResponse.json({ error: 'Device Not Found' }, { status: 404 });
    }

    const logs = await prisma.batteryLog.findMany({
      where: { deviceId: id, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 50000,
    });

    const csv = toCsv(
      logs.map((l) => ({
        timestamp: l.createdAt.toISOString(),
        batteryLevel: l.batteryLevel,
        isCharging: l.isCharging,
        eventType: l.eventType,
      })),
      ['timestamp', 'batteryLevel', 'isCharging', 'eventType']
    );

    const safeName = device.name.replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_').slice(0, 60) || device.id;
    logApiRequest({ method: 'GET', path, status: 200, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { success: true, rows: logs.length } });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="battery_${safeName}_${days}d.csv"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Failed to export device logs:', error);
    logApiRequest({ method: 'GET', path, status: 500, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
