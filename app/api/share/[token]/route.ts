import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiRequest } from '@/lib/api-logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Feature 14: public, unauthenticated endpoint backing /share/[token] and the
// <iframe> embed widget. Only exposes the minimal fields needed to render a
// battery status card — never the full device record, logs, or API keys.
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const startTime = Date.now();
  const { token } = await ctx.params;
  const path = `/api/share/${token}`;
  try {
    const shareToken = await prisma.shareToken.findUnique({ where: { token } });
    if (!shareToken) {
      logApiRequest({ method: 'GET', path, status: 404, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Not Found' } });
      return NextResponse.json({ error: 'ลิงก์แชร์นี้ไม่ถูกต้องหรือถูกยกเลิกแล้ว' }, { status: 404 });
    }

    if (shareToken.expiresAt && shareToken.expiresAt.getTime() < Date.now()) {
      logApiRequest({ method: 'GET', path, status: 410, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Expired' } });
      return NextResponse.json({ error: 'ลิงก์แชร์นี้หมดอายุแล้ว' }, { status: 410 });
    }

    const devices = await prisma.device.findMany({
      where: { id: { in: shareToken.deviceIds } },
      orderBy: { order: 'asc' },
    });

    const now = Date.now();
    const publicDevices = devices.map((d) => {
      const minutesSinceUpdate = (now - d.updatedAt.getTime()) / (1000 * 60);
      const isOffline = minutesSinceUpdate > (d.offlineTimeoutMinutes ?? 60);
      return {
        id: d.id,
        name: d.name,
        platform: d.platform,
        batteryLevel: d.batteryLevel,
        isCharging: d.isCharging,
        updatedAt: d.updatedAt.toISOString(),
        isOffline,
      };
    });

    logApiRequest({ method: 'GET', path, status: 200, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { success: true, count: publicDevices.length } });
    return NextResponse.json(
      { devices: publicDevices, expiresAt: shareToken.expiresAt?.toISOString() ?? null },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Failed to fetch share token:', error);
    logApiRequest({ method: 'GET', path, status: 500, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
