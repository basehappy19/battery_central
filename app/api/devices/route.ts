import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device, BatteryLog } from '@prisma/client';
import { checkRateLimit, getClientIp, verifyDashboardAuth, sanitizeString } from '@/lib/security';

type DeviceWithLogs = Device & {
  logs: BatteryLog[];
};

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`get_devices_${ip}`, 120, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const now = new Date();

    const setting = await prisma.setting.findUnique({ where: { key: 'api_secret_key' } });
    const systemApiKey = setting?.value || process.env.API_SECRET_KEY || 'secret_batt_2026';

    const devices = (await prisma.device.findMany({
      orderBy: { updatedAt: 'desc' },
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

        if (
          (l.eventType === 'PLUGGED_IN' ||
            l.eventType === 'UNPLUGGED' ||
            l.eventType === 'FULL_CHARGE' ||
            l.eventType === 'RECONNECTED') &&
          history.length < 10
        ) {
          let chargeGained: number | undefined = undefined;
          let durationMinutes: number | undefined = undefined;
          let offlineDurationMinutes: number | undefined = undefined;
          let offlineSince: string | undefined = undefined;

          if (l.eventType === 'UNPLUGGED') {
            for (let j = i + 1; j < logs.length; j++) {
              const prev = logs[j];
              if (prev.eventType === 'PLUGGED_IN' || (prev.eventType === 'INITIAL' && prev.isCharging)) {
                chargeGained = l.batteryLevel - prev.batteryLevel;
                const timeDiffMs = l.createdAt.getTime() - prev.createdAt.getTime();
                durationMinutes = Math.max(1, Math.round(timeDiffMs / (1000 * 60)));
                break;
              }
            }
          } else if (l.eventType === 'RECONNECTED') {
            for (let j = i + 1; j < logs.length; j++) {
              const prev = logs[j];
              const timeDiffMs = l.createdAt.getTime() - prev.createdAt.getTime();
              offlineDurationMinutes = Math.max(1, Math.round(timeDiffMs / (1000 * 60)));
              offlineSince = prev.createdAt.toISOString();
              break;
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
          });
        }
      }

      if (logs.length === 0) {
        if (device.isCharging) pluggedCount = 1;
        else unpluggedCount = 1;
      }

      const graphData = logs
        .slice()
        .reverse()
        .map((l) => ({
          time: l.createdAt.toISOString(),
          level: l.batteryLevel,
          isCharging: l.isCharging,
        }));

      if (graphData.length === 0 || graphData[graphData.length - 1].level !== device.batteryLevel) {
        graphData.push({
          time: device.updatedAt.toISOString(),
          level: device.batteryLevel,
          isCharging: device.isCharging,
        });
      }

      const timeSinceUpdateMinutes = (now.getTime() - device.updatedAt.getTime()) / (1000 * 60);
      const isOffline = timeSinceUpdateMinutes > 15;
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

    return NextResponse.json(
      { devices: devicesWithStats, systemApiKey },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Failed to fetch devices:', error);
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
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`post_devices_${ip}`, 30, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const isAuthorized = await verifyDashboardAuth(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Invalid dashboard session token' }, { status: 401 });
    }

    const body = (await request.json()) as PostPayload;
    const { name, platform } = body;

    const cleanName = name ? sanitizeString(name, 50) : 'อุปกรณ์ใหม่';
    const cleanPlatform = platform ? sanitizeString(platform, 30) : 'Android';

    // Generate unique ID: bat- + 6 random alphanumeric characters
    const randomHex = Math.random().toString(36).substring(2, 8).toLowerCase();
    const newId = `bat-${randomHex}`;

    const newDevice = await prisma.device.create({
      data: {
        id: newId,
        name: cleanName,
        platform: cleanPlatform,
        batteryLevel: 0,
        isCharging: false,
        acceptingUpdates: true,
      },
    });

    const setting = await prisma.setting.findUnique({ where: { key: 'api_secret_key' } });
    const apiKey = setting?.value || process.env.API_SECRET_KEY || 'secret_batt_2026';

    return NextResponse.json({ success: true, device: newDevice, apiKey }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create device:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

interface PatchPayload {
  id?: string;
  name?: string;
  acceptingUpdates?: boolean | string;
}

export async function PATCH(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`patch_devices_${ip}`, 30, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const isAuthorized = await verifyDashboardAuth(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Invalid dashboard session token' }, { status: 401 });
    }

    const body = (await request.json()) as PatchPayload;
    const { id, name, acceptingUpdates } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid device id' }, { status: 400 });
    }

    const cleanId = sanitizeString(id, 50);
    const cleanName = name !== undefined ? sanitizeString(name, 50) : undefined;

    const updated = await prisma.device.update({
      where: { id: cleanId },
      data: {
        ...(cleanName !== undefined && { name: cleanName }),
        ...(acceptingUpdates !== undefined && { acceptingUpdates: Boolean(acceptingUpdates) }),
      },
    });

    return NextResponse.json({ success: true, device: updated }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to update device:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`delete_devices_${ip}`, 30, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const isAuthorized = await verifyDashboardAuth(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Invalid dashboard session token' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid device id' }, { status: 400 });
    }

    const cleanId = sanitizeString(id, 50);

    await prisma.batteryLog.deleteMany({
      where: { deviceId: cleanId },
    });

    await prisma.device.delete({
      where: { id: cleanId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to delete device:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
