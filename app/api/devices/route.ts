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
          history.push({
            id: l.id,
            batteryLevel: l.batteryLevel,
            isCharging: l.isCharging,
            eventType: l.eventType,
            createdAt: l.createdAt.toISOString(),
          });
        }
      }

      if (logs.length === 0) {
        if (device.isCharging) pluggedCount = 1;
        else unpluggedCount = 1;
      }

      return {
        id: device.id,
        name: device.name,
        platform: device.platform,
        batteryLevel: device.batteryLevel,
        isCharging: device.isCharging,
        timeRemaining: device.timeRemaining,
        updatedAt: device.updatedAt.toISOString(),
        todayStats: {
          pluggedCount,
          unpluggedCount,
          maxBattery,
          minBattery,
          history,
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
