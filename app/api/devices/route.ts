import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device, BatteryLog } from '@prisma/client';

type DeviceWithLogs = Device & {
  logs: BatteryLog[];
};

export async function GET() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

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
          (l.eventType === 'PLUGGED_IN' || l.eventType === 'UNPLUGGED' || l.eventType === 'FULL_CHARGE') &&
          history.length < 10
        ) {
          let chargeGained: number | undefined = undefined;
          let durationMinutes: number | undefined = undefined;

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
          }

          history.push({
            id: l.id,
            batteryLevel: l.batteryLevel,
            isCharging: l.isCharging,
            eventType: l.eventType,
            createdAt: l.createdAt.toISOString(),
            chargeGained,
            durationMinutes,
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

      return {
        id: device.id,
        name: device.name,
        platform: device.platform,
        batteryLevel: device.batteryLevel,
        isCharging: device.isCharging,
        timeRemaining: device.timeRemaining,
        acceptingUpdates: device.acceptingUpdates,
        updatedAt: device.updatedAt.toISOString(),
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
      { devices: devicesWithStats },
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

interface PatchPayload {
  id?: string;
  name?: string;
  acceptingUpdates?: boolean | string;
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PatchPayload;
    const { id, name, acceptingUpdates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing device id' }, { status: 400 });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(acceptingUpdates !== undefined && { acceptingUpdates: Boolean(acceptingUpdates) }),
      },
    });

    return NextResponse.json({ success: true, device: updated }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to update device:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
