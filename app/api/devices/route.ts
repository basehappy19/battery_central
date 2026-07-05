import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSystemSettings } from '@/lib/settings';
import type { Device, BatteryLog } from '@prisma/client';
import { logApiRequest } from '@/lib/api-logger';

type DeviceWithLogs = Device & {
  logs: BatteryLog[];
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const startTime = Date.now();
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const now = new Date();

    const sysSettings = await getSystemSettings();
    const systemApiKey = sysSettings.api_secret_key || process.env.API_SECRET_KEY || 'secret_batt_2026';
    const offlineThreshold = Number(sysSettings.offline_threshold_minutes) || 60;

    const devices = (await prisma.device.findMany({
      orderBy: [
        { order: 'asc' },
        { updatedAt: 'desc' },
      ],
      include: {
        logs: {
          where: {
            createdAt: {
              gte: startOfToday,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })) as DeviceWithLogs[];

    const devicesWithStats = devices.map((device: DeviceWithLogs) => {
      const logs: BatteryLog[] = device.logs || [];
      
      let pluggedCount = 0;
      let unpluggedCount = 0;
      let maxBattery = device.batteryLevel;
      let minBattery = device.batteryLevel;
      const history: {
        id: string;
        batteryLevel: number;
        isCharging: boolean;
        eventType: string;
        createdAt: string;
        chargeGained?: number;
        durationMinutes?: number;
        offlineDurationMinutes?: number;
        offlineSince?: string;
        startChargeTime?: string;
        startChargeLevel?: number;
      }[] = [];

      for (let i = 0; i < logs.length; i++) {
        const l = logs[i];
        if (l.batteryLevel > maxBattery) maxBattery = l.batteryLevel;
        if (l.batteryLevel < minBattery) minBattery = l.batteryLevel;

        if (l.eventType === 'PLUGGED_IN' || (l.eventType === 'INITIAL' && l.isCharging)) {
          pluggedCount++;
        } else if (l.eventType === 'UNPLUGGED' || (l.eventType === 'INITIAL' && !l.isCharging)) {
          unpluggedCount++;
        }

        let chargeGained: number | undefined;
        let durationMinutes: number | undefined;
        let offlineDurationMinutes: number | undefined;
        let offlineSince: string | undefined;
        let startChargeTime: string | undefined;
        let startChargeLevel: number | undefined;

        if (l.eventType === 'RECONNECTED') {
          const prevLog = logs[i + 1];
          if (prevLog) {
            const diffMs = l.createdAt.getTime() - prevLog.createdAt.getTime();
            offlineDurationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
            offlineSince = prevLog.createdAt.toISOString();
          }
        } else if (l.eventType === 'UNPLUGGED' || l.eventType === 'FULL_CHARGE') {
          let alreadySummarizedFull = false;
          if (l.eventType === 'UNPLUGGED') {
            for (let j = i + 1; j < logs.length; j++) {
              const prevLog = logs[j];
              if (prevLog.eventType === 'FULL_CHARGE') {
                alreadySummarizedFull = true;
                break;
              }
              if (prevLog.eventType === 'PLUGGED_IN' || (!prevLog.isCharging && j > i + 1)) {
                break;
              }
            }
          }

          if (!alreadySummarizedFull) {
            for (let j = i + 1; j < logs.length; j++) {
              const prevLog = logs[j];
              if (prevLog.eventType === 'PLUGGED_IN' || (!prevLog.isCharging && j > i + 1)) {
                const startLog = prevLog.eventType === 'PLUGGED_IN' ? prevLog : logs[j - 1];
                if (startLog && startLog.isCharging) {
                  const gained = l.batteryLevel - startLog.batteryLevel;
                  if (gained !== 0 || l.batteryLevel < 100) {
                    startChargeTime = startLog.createdAt.toISOString();
                    startChargeLevel = startLog.batteryLevel;
                    chargeGained = gained;
                    const diffMs = l.createdAt.getTime() - startLog.createdAt.getTime();
                    durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
                  }
                }
                break;
              }
            }
          }
        }

        history.push({
          id: l.id,
          batteryLevel: l.batteryLevel,
          isCharging: l.isCharging,
          eventType: l.eventType,
          createdAt: l.createdAt.toISOString(),
          chargeGained,
          durationMinutes,
          offlineDurationMinutes,
          offlineSince,
          startChargeTime,
          startChargeLevel,
        });
      }

      const graphData = logs
        .slice()
        .reverse()
        .map((l: BatteryLog) => ({
          time: l.createdAt.toISOString(),
          level: l.batteryLevel,
          isCharging: l.isCharging,
        }));

      if (graphData.length === 0 || graphData[graphData.length - 1].time !== device.updatedAt.toISOString()) {
        graphData.push({
          time: device.updatedAt.toISOString(),
          level: device.batteryLevel,
          isCharging: device.isCharging,
        });
      }

      const timeSinceUpdateMinutes = (now.getTime() - device.updatedAt.getTime()) / (1000 * 60);
      const isOffline = timeSinceUpdateMinutes > offlineThreshold;
      const offlineDurationMinutes = isOffline ? Math.round(timeSinceUpdateMinutes) : undefined;
      const offlineSince = isOffline ? device.updatedAt.toISOString() : undefined;

      return {
        id: device.id,
        name: device.name,
        platform: device.platform,
        batteryLevel: device.batteryLevel,
        isCharging: device.isCharging,
        timeRemaining: device.timeRemaining,
        acceptingUpdates: device.acceptingUpdates,
        updatedAt: device.updatedAt.toISOString(),
        isOffline,
        offlineDurationMinutes,
        offlineSince,
        todayStats: {
          pluggedCount,
          unpluggedCount,
          maxBattery,
          minBattery,
          history,
          graphData,
        },
      };
    });

    const resBody = { devices: devicesWithStats, systemApiKey };
    logApiRequest({ method: 'GET', path: '/api/devices', status: 200, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { success: true, count: devicesWithStats.length } });
    return NextResponse.json(
      resBody,
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Failed to fetch devices:', error);
    logApiRequest({ method: 'GET', path: '/api/devices', status: 500, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

interface PostPayload {
  name?: string;
  platform?: string;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let body: PostPayload | null = null;
  try {
    body = (await request.json()) as PostPayload;
    const { name, platform } = body || {};

    const cleanName = name && String(name).trim() ? String(name).trim() : 'อุปกรณ์ใหม่';
    const cleanPlatform = platform && String(platform).trim() ? String(platform).trim() : 'Android';

    const randomHex = crypto.randomBytes(12).toString('hex');
    const newId = `bat-${randomHex.slice(0, 6)}-${randomHex.slice(6, 12)}-${randomHex.slice(12, 18)}-${randomHex.slice(18, 24)}`;

    const maxOrderDevice = await prisma.device.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderDevice?.order ?? -1) + 1;

    const newDevice = await prisma.device.create({
      data: {
        id: newId,
        name: cleanName,
        platform: cleanPlatform,
        batteryLevel: 0,
        isCharging: false,
        acceptingUpdates: true,
        order: nextOrder,
      },
    });

    const sysSettings = await getSystemSettings();
    const apiKey = sysSettings.api_secret_key || process.env.API_SECRET_KEY || 'secret_batt_2026';

    const resBody = { success: true, device: newDevice, apiKey };
    logApiRequest({ method: 'POST', path: '/api/devices', status: 201, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: resBody });
    return NextResponse.json(resBody, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create device:', error);
    logApiRequest({ method: 'POST', path: '/api/devices', status: 500, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

interface PatchPayload {
  id?: string;
  name?: string;
  acceptingUpdates?: boolean | string;
}

export async function PATCH(request: Request) {
  const startTime = Date.now();
  let body: PatchPayload | null = null;
  try {
    body = (await request.json()) as PatchPayload;
    const { id, name, acceptingUpdates } = body || {};

    if (!id || typeof id !== 'string') {
      logApiRequest({ method: 'PATCH', path: '/api/devices', status: 400, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: { error: 'Missing or invalid device id' } });
      return NextResponse.json({ error: 'Missing or invalid device id' }, { status: 400 });
    }

    const cleanId = String(id).trim();
    const cleanName = name !== undefined ? String(name).trim() : undefined;

    const updated = await prisma.device.updateMany({
      where: { id: cleanId },
      data: {
        ...(cleanName !== undefined && { name: cleanName }),
        ...(acceptingUpdates !== undefined && { acceptingUpdates: Boolean(acceptingUpdates) }),
      },
    });

    if (updated.count === 0) {
      logApiRequest({ method: 'PATCH', path: '/api/devices', status: 404, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: { error: 'Device Not Found' } });
      return NextResponse.json({ error: 'ไม่พบอุปกรณ์นี้ในระบบ (Device Not Found)' }, { status: 404 });
    }

    const updatedDevice = await prisma.device.findFirst({ where: { id: cleanId } });
    const resBody = { success: true, device: updatedDevice };
    logApiRequest({ method: 'PATCH', path: '/api/devices', status: 200, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: resBody });
    return NextResponse.json(resBody, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to update device:', error);
    logApiRequest({ method: 'PATCH', path: '/api/devices', status: 500, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const startTime = Date.now();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id || typeof id !== 'string') {
      logApiRequest({ method: 'DELETE', path: '/api/devices', status: 400, durationMs: Date.now() - startTime, req: request, requestBody: { id }, responseBody: { error: 'Missing or invalid device id' } });
      return NextResponse.json({ error: 'Missing or invalid device id' }, { status: 400 });
    }

    const cleanId = String(id).trim();

    await prisma.batteryLog.deleteMany({
      where: { deviceId: cleanId },
    });

    const deleted = await prisma.device.deleteMany({
      where: { id: cleanId },
    });

    if (deleted.count === 0) {
      logApiRequest({ method: 'DELETE', path: '/api/devices', status: 404, durationMs: Date.now() - startTime, req: request, requestBody: { id }, responseBody: { error: 'Device Not Found' } });
      return NextResponse.json({ error: 'ไม่พบอุปกรณ์นี้ในระบบ' }, { status: 404 });
    }

    const resBody = { success: true };
    logApiRequest({ method: 'DELETE', path: '/api/devices', status: 200, durationMs: Date.now() - startTime, req: request, requestBody: { id }, responseBody: resBody });
    return NextResponse.json(resBody, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to delete device:', error);
    logApiRequest({ method: 'DELETE', path: '/api/devices', status: 500, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

interface PutOrderPayload {
  order?: string[];
}

export async function PUT(request: Request) {
  const startTime = Date.now();
  let body: PutOrderPayload | null = null;
  try {
    body = (await request.json()) as PutOrderPayload;
    const { order } = body || {};

    if (!order || !Array.isArray(order)) {
      logApiRequest({ method: 'PUT', path: '/api/devices', status: 400, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: { error: 'Invalid order array' } });
      return NextResponse.json({ error: 'Invalid order array' }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((id, index) =>
        prisma.device.updateMany({
          where: { id: String(id).trim() },
          data: { order: index },
        })
      )
    );

    const resBody = { success: true };
    logApiRequest({ method: 'PUT', path: '/api/devices', status: 200, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: resBody });
    return NextResponse.json(resBody, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to update device order:', error);
    logApiRequest({ method: 'PUT', path: '/api/devices', status: 500, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
